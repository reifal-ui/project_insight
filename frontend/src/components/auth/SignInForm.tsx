import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import { authAPI } from "../../services/api";
import { setAuthData } from "../../utils/auth";
import Button from "../ui/button/Button";
import Alert from "../ui/alert/Alert";

interface FormData {
  email: string;
  password: string;
}

interface AlertState {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}

export default function SignInForm(): JSX.Element {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    setAlert(null);

    try {
      const response = await authAPI.login(formData.email, formData.password);
      console.log("Login Response:", response);

      const token =
        response?.access ||
        response?.token ||
        response?.data?.access ||
        response?.data?.token;

      const user =
        response?.user ||
        response?.data?.user ||
        (typeof response === "object" && !Array.isArray(response) ? response : null);

      if (token && user) {
        setAuthData(token, user);

        if (isChecked) {
          localStorage.setItem("token", token);
          localStorage.setItem("user", JSON.stringify(user));
        }

        setAlert({
          variant: "success",
          title: "Login Successful!",
          message: "Welcome back! Redirecting to dashboard...",
        });

        setTimeout(() => {
          navigate("/TailAdmin/");
        }, 1500);
      } else {
        setAlert({
          variant: "error",
          title: "Invalid Response",
          message: "Login response tidak valid dari server.",
        });
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      const status = err?.response?.status;
      let title = "Login Failed";
      let message =
        err?.response?.data?.non_field_errors?.[0] ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Login gagal. Periksa email dan password.";

      if (status === 401) {
        title = "Invalid Credentials";
        message = "The email or password you entered is incorrect.";
      } else if (status === 404) {
        title = "Account Not Found";
        message = "We couldn't find an account with this email.";
      } else if (status === 403) {
        title = "Account Disabled";
        message = "Your account has been disabled. Contact support.";
      } else if (status === 500) {
        title = "Server Error";
        message = "Server error. Please try again later.";
      }

      setAlert({
        variant: "error",
        title,
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="w-full max-w-md pt-10 mx-auto">
        {/* ⚠️ Link ini bisa bikin reload saat login error
            Kalau masih bikin masalah, hapus dulu bagian ini */}
        <Link
          to="/TailAdmin/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Back to dashboard
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email and password to sign in!
            </p>
          </div>

          {alert && (
            <div className="mb-6">
              <Alert
                variant={alert.variant}
                title={alert.title}
                message={alert.message}
              />
            </div>
          )}

          <form onSubmit={handleLogin} noValidate>
            <div className="space-y-6">
              <div>
                <Label>
                  Email <span className="text-error-500">*</span>
                </Label>
                <Input
                  name="email"
                  type="email"
                  placeholder="info@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label>
                  Password <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox checked={isChecked} onChange={setIsChecked} />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Keep me logged in
                  </span>
                </div>
                <Link
                  to="#!"
                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Forgot password?
                </Link>
              </div>
              <div>
                <Button
                  className="w-full"
                  size="sm"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              Don&apos;t have an account?{" "}
              <Link
                to="/TailAdmin/signup"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
