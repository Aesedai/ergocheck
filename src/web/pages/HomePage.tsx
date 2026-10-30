import { useAuth } from '../auth';

export function HomePage() {
  const { me } = useAuth();
  return (
    <>
      <h1>Hi, {me!.user.displayName.split(' ')[0]}</h1>
      <p className="muted">Signed in to {me!.org.name}.</p>
    </>
  );
}
