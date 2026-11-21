using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuranShikkha.Core.Entities;
using QuranShikkha.Infrastructure.Data;

namespace QuranShikkha.Api.Auth;

public class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "quran-shikkha";
    public string Audience { get; set; } = "quran-shikkha-clients";
    public int Days { get; set; } = 60;
    public string? GoogleClientId { get; set; }
}

public record AuthResponse(string Token, Guid UserId, bool IsGuest, string? Email);

public sealed class TokenService(Microsoft.Extensions.Options.IOptions<JwtOptions> o)
{
    public static SymmetricSecurityKey KeyOf(JwtOptions o) => new(Encoding.UTF8.GetBytes(o.Key));

    public AuthResponse Issue(AppUser u)
    {
        var opt = o.Value;
        var jwt = new JwtSecurityToken(opt.Issuer, opt.Audience,
            new[] { new Claim(JwtRegisteredClaimNames.Sub, u.Id.ToString()), new Claim("guest", u.IsGuest ? "1" : "0") },
            expires: DateTime.UtcNow.AddDays(opt.Days),
            signingCredentials: new SigningCredentials(KeyOf(opt), SecurityAlgorithms.HmacSha256));
        return new AuthResponse(new JwtSecurityTokenHandler().WriteToken(jwt), u.Id, u.IsGuest, u.Email);
    }
}

public static class UserContext
{
    public static Guid? UserId(this ClaimsPrincipal p) =>
        Guid.TryParse(p.FindFirstValue(ClaimTypes.NameIdentifier) ?? p.FindFirstValue(JwtRegisteredClaimNames.Sub), out var g) ? g : null;
}

public static class PasswordRules
{
    public static string? Validate(string? email, string? password) =>
        string.IsNullOrWhiteSpace(email) || !email.Contains('@') ? "Valid email required."
        : password is null || password.Length < 8 ? "Password must be at least 8 characters." : null;
}
