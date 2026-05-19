import splashLogo from '../assets/splash_screen_logo.jpeg';
import './SplashScreen.css';

export default function SplashScreen() {
  return (
    <div className="splash-screen" role="presentation" aria-hidden="true">
      <img src={splashLogo} alt="VolleySync" className="splash-screen-logo" />
    </div>
  );
}
