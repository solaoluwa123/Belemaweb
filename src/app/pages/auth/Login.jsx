import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { FaEye, FaEyeSlash, FaLeaf, FaLock, FaGoogle, FaLinkedin, FaFacebook } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { detectSuspiciousPatterns, rateLimiter, sanitizeInput } from "../../utils/security";
import { ETranzactWordmark } from "../../components/branding/ETranzactWordmark";
import { LoginFinanceHero } from "../../components/branding/LoginFinanceHero";
import { useBrand } from "../../../branding/useBrand";
import { readLocalStorage, removeLocalStorage, setLocalStorage, STORAGE_KEY_NAMES } from "../../config/storage";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const { loginWithCredentials, loginAsDevVendor, isRole4DevBypassEnabled } = useAuth();
  const { brand } = useBrand();

  useEffect(() => {
    const remembered = readLocalStorage(STORAGE_KEY_NAMES.REMEMBER_EMAIL);
    if (remembered) {
      setIdentifier(remembered);
      setRememberMe(true);
    }
  }, []);

  const handleDevVendorBypass = (e) => {
    e?.preventDefault?.();
    setError("");
    setLoading(true);
    try {
      const result = loginAsDevVendor();
      if (!result.success) {
        setError(result.error || "Dev bypass failed.");
        return;
      }
      navigate("/transactions", { replace: true });
    } catch (err) {
      setError(err?.message || "Dev bypass failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmedIdentifier = sanitizeInput(identifier.trim());

    if (!trimmedIdentifier || !password) {
      setError("Please enter your username or email and password");
      return;
    }

    if (detectSuspiciousPatterns(trimmedIdentifier) || detectSuspiciousPatterns(password)) {
      setError("Suspicious input detected.");
      return;
    }

    if (rateLimiter.isRateLimited(`login:${trimmedIdentifier.toLowerCase()}`, 5, 60000)) {
      setError("Too many failed attempts. Please wait a minute and try again.");
      return;
    }

    setError("");
    setLoading(true);

    setTimeout(async () => {
      const result = await loginWithCredentials(trimmedIdentifier, password);
      setLoading(false);
      if (!result.success) {
        setError(result.error || "Invalid email or password");
        return;
      }

      rateLimiter.reset(`login:${trimmedIdentifier.toLowerCase()}`);

      if (rememberMe) {
        setLocalStorage(STORAGE_KEY_NAMES.REMEMBER_EMAIL, trimmedIdentifier);
      } else {
        removeLocalStorage(STORAGE_KEY_NAMES.REMEMBER_EMAIL);
      }

      if (result.requiresTwoFactor) {
        navigate("/2fa", { replace: true });
        return;
      }

      navigate(result.redirectTo || "/transactions", { replace: true });
    }, 600);
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-3 py-4 sm:px-4"
      style={{
        backgroundImage: `linear-gradient(145deg, ${brand.theme.loginHero} 0%, ${brand.theme.loginPrimary || brand.theme.primary} 42%, ${brand.theme.loginSurface} 100%)`,
        backgroundColor: brand.theme.loginSurface,
      }}
    >
      <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl md:flex-row">
        <div
          className="flex min-h-[220px] flex-col items-center justify-center md:w-1/2 md:rounded-br-none md:rounded-tr-[120px]"
          style={{ backgroundColor: brand.theme.loginHero || brand.theme.sidebar }}
        >
          <div className="px-5 sm:px-8">
            <LoginFinanceHero className="w-[220px] sm:w-[260px] md:w-[360px]" />
          </div>
        </div>

        <div
          className="relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden px-4 py-8 sm:px-6 sm:py-10 md:w-1/2 md:rounded-bl-[120px]"
          style={{
            backgroundImage: `linear-gradient(to bottom right, ${brand.theme.authPanelFrom}, ${brand.theme.authPanelVia}, ${brand.theme.authPanelTo})`,
          }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <FaLeaf className="absolute left-4 top-8 text-3xl rotate-[-18deg] sm:left-8 sm:top-10 sm:text-5xl" style={{ color: brand.theme.leafPrimary }} />
            <FaLeaf className="absolute right-4 top-12 text-3xl rotate-[22deg] sm:right-8 sm:top-16 sm:text-4xl" style={{ color: brand.theme.leafSecondary }} />
            <FaLeaf className="absolute left-5 bottom-16 text-4xl rotate-[16deg] sm:left-10 sm:bottom-20 sm:text-6xl" style={{ color: brand.theme.leafTertiary }} />
            <FaLeaf className="absolute right-6 bottom-8 text-4xl rotate-[-24deg] sm:right-14 sm:bottom-12 sm:text-5xl" style={{ color: brand.theme.leafPrimary }} />
            <FaLeaf className="absolute left-1/2 top-1/3 hidden text-4xl rotate-[38deg] sm:block" style={{ color: brand.theme.leafTertiary }} />
            <FaLeaf className="absolute right-1/3 bottom-1/3 hidden text-3xl rotate-[-10deg] sm:block" style={{ color: brand.theme.leafSecondary }} />
          </div>

          <ETranzactWordmark
            className="relative z-10"
            textClassName="h-[78px] w-[120px] text-[1.6rem] sm:h-[100px] sm:w-[150px] sm:text-[2.3rem]"
          />

          <div className="relative z-10 mt-4 flex w-full max-w-sm flex-col items-center sm:mt-5">
            <h2 className="text-center text-xl font-bold text-black sm:text-2xl">{brand.productText.loginHeading}</h2>

            <form
              onSubmit={handleLogin}
              className="mt-5 flex w-full flex-col items-center gap-4"
            >
              <input
                type="text"
                placeholder="Email or username"
                className="w-full rounded-lg border-2 border-border bg-[color:var(--color-input-background)] p-2 text-black focus:border-primary focus:outline-none"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />

              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="w-full rounded-lg border-2 border-border bg-[color:var(--color-input-background)] p-2 pr-10 text-black focus:border-primary focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="mt-2 flex w-full flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-gray-700 sm:mb-0">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-primary"
                    checked={rememberMe}
                    onChange={() => setRememberMe(!rememberMe)}
                  />
                  Remember me
                </label>

                <a
                  href="/password-recovery"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <FaLock size={12} /> Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary py-2 text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Signing in..." : "Log in"}
              </button>

              {isRole4DevBypassEnabled() ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleDevVendorBypass}
                  className="w-full rounded-lg border-2 border-amber-500 bg-amber-50 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Continue as FI contact (Role 4 dev bypass)
                </button>
              ) : null}

              <div className="mt-4 flex w-full flex-wrap justify-center text-center text-sm text-gray-600">
                Need activation?{" "}
                <a
                  href="/activate"
                  className="ml-1 text-primary hover:underline"
                >
                  {brand.productText.activationPrompt}
                </a>
              </div>
            </form>

            
          </div>
        </div>
      </div>
    </div>
  );
}
