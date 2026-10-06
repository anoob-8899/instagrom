"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { AlertCircle, Camera, Loader2, Eye, EyeOff, ShieldCheck, Wifi } from "lucide-react";
import { isValid6DigitPassword } from "@/lib/auth/password";

export const RegisterForm: React.FC = () => {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }

    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }

    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters long.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (!isValid6DigitPassword(password)) {
      setError("Password must be exactly 6 numeric digits.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Failed to create account. Please try again.");
      } else {
        // Automatically redirects to /feed since registration creates an active session
        router.push("/feed");
        router.refresh();
      }
    } catch {
      setError("Unable to reach the INSTAGROM host server. Please verify your local network connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-200 shadow-lg dark:border-slate-800">
      <CardHeader className="space-y-3 text-center pb-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white shadow-md">
          <Camera className="h-7 w-7" />
        </div>
        <div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            INSTAGROM
          </CardTitle>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            Create your account
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Join the classroom network on this shared host
          </p>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {error && (
            <div
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <Input
            id="register-username"
            label="Username"
            type="text"
            autoComplete="username"
            placeholder="e.g. alice"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            helperText="3-30 characters (letters, numbers, dots, underscores)"
            required
            disabled={loading}
          />

          <Input
            id="register-displayname"
            label="Display Name"
            type="text"
            placeholder="e.g. Alice Cooper"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            disabled={loading}
          />

          <div className="space-y-1.5">
            <label
              htmlFor="register-password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              6-digit password
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="new-password"
                placeholder="6-digit password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="register-confirm-password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Confirm 6-digit password
            </label>
            <div className="relative">
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="new-password"
                placeholder="Re-enter 6-digit password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>Passwords securely hashed with bcrypt in SQLite database</span>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3.5 pt-2">
          <Button
            type="submit"
            className="w-full font-semibold shadow-sm"
            disabled={
              loading ||
              !username.trim() ||
              !displayName.trim() ||
              !password ||
              !confirmPassword
            }
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating account...</span>
              </span>
            ) : (
              "Create Account"
            )}
          </Button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
};
