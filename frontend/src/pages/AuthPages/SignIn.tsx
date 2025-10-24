import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Project_insight SignIn Dashboard | Selamat datang!"
        description="This is SignIn Tables Dashboard page for Project_Insight"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
