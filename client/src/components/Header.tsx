import { NavLink } from 'react-router-dom';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <h1 className={styles.logo}>DayLog</h1>
        <nav className={styles.nav}>
          <NavLink to="/" className={({ isActive }) => isActive ? styles.active : ''}>
            Today
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => isActive ? styles.active : ''}>
            History
          </NavLink>
          <NavLink to="/test-runs" className={({ isActive }) => isActive ? styles.active : ''}>
            Test Runs
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
