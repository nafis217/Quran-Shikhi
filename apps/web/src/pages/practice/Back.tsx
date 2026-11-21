import { Link } from 'react-router-dom';
import { useSettings } from '../../settings';

export function Back() {
  const { t } = useSettings();
  return <nav><Link to="/practice">← {t('practice')}</Link></nav>;
}
