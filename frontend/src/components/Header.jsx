import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home' },
  { to: '/contact', label: 'Contact' },
];

export default function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <NavLink to="/" className="logo">Print Media Online</NavLink>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end className="nav-link">{l.label}</NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
