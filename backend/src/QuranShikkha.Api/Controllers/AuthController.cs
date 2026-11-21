using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using QuranShikkha.Api.Auth;
using QuranShikkha.Core.Entities;
using QuranShikkha.Infrastructure.Data;

namespace QuranShikkha.Api.Controllers;

public record CredentialsRequest(string Email, string Password);
public record GoogleRequest(string IdToken);

[ApiController, Route("api/v1/auth")]
public class AuthController(AppDbContext db, TokenService tokens, IOptions<JwtOptions> jwt) : ControllerBase
{
    private static readonly PasswordHasher<AppUser> Hasher = new();

    /// <summary>Anonymous guest: the app works with no account. Returns a token tied to a guest user.</summary>
    [HttpPost("guest")]
    public async Task<AuthResponse> Guest(CancellationToken ct)
    {
        var u = new AppUser { IsGuest = true };
        db.Users.Add(u);
        await db.SaveChangesAsync(ct);
        return tokens.Issue(u);
    }

    /// <summary>Register. If called with a guest token, the guest account is upgraded so progress is kept.</summary>
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(CredentialsRequest r, CancellationToken ct)
    {
        if (PasswordRules.Validate(r.Email, r.Password) is { } err) return Problem(err, statusCode: 400);
        var email = r.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == email, ct)) return Problem("Email already registered.", statusCode: 409);
        var guestId = User.UserId();
        var u = guestId is null ? null : await db.Users.FirstOrDefaultAsync(x => x.Id == guestId && x.IsGuest, ct);
        if (u == null) db.Users.Add(u = new AppUser());
        u.IsGuest = false; u.Email = email;
        u.PasswordHash = Hasher.HashPassword(u, r.Password);
        await db.SaveChangesAsync(ct);
        return tokens.Issue(u);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(CredentialsRequest r, CancellationToken ct)
    {
        var email = (r.Email ?? "").Trim().ToLowerInvariant();
        var u = await db.Users.FirstOrDefaultAsync(x => x.Email == email, ct);
        if (u?.PasswordHash == null || Hasher.VerifyHashedPassword(u, u.PasswordHash, r.Password ?? "") == PasswordVerificationResult.Failed)
            return Problem("Invalid email or password.", statusCode: 401);
        return tokens.Issue(u);
    }

    [HttpPost("google")]
    public async Task<ActionResult<AuthResponse>> Google(GoogleRequest r, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(jwt.Value.GoogleClientId)) return Problem("Google sign-in is not configured.", statusCode: 501);
        GoogleJsonWebSignature.Payload p;
        try { p = await GoogleJsonWebSignature.ValidateAsync(r.IdToken, new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { jwt.Value.GoogleClientId } }); }
        catch (InvalidJwtException) { return Problem("Invalid Google token.", statusCode: 401); }

        var u = await db.Users.FirstOrDefaultAsync(x => x.GoogleSubject == p.Subject, ct);
        if (u == null)
        {
            var guestId = User.UserId();
            u = guestId is null ? null : await db.Users.FirstOrDefaultAsync(x => x.Id == guestId && x.IsGuest, ct);
            if (u == null) db.Users.Add(u = new AppUser());
            u.IsGuest = false; u.GoogleSubject = p.Subject; u.Email ??= p.Email?.ToLowerInvariant();
            await db.SaveChangesAsync(ct);
        }
        return tokens.Issue(u);
    }
}
