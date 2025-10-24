import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Project_insight SignIn Dashboard | Selamat datang!"
        description="This is SignIn Tables Dashboard page for Project_Insight"
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
