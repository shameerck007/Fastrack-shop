import LoginForm from "@/components/LoginForm";
import { getRequestCountryCode } from "@/lib/get-request-country";

export default async function LoginPage() {
  const defaultCountryCode = await getRequestCountryCode();
  return <LoginForm defaultCountryCode={defaultCountryCode} />;
}
