import LoginForm from "@/components/LoginForm";
import { getDefaultPhoneCountry } from "@/lib/get-request-country";

export default async function LoginPage() {
  const defaultCountryCode = await getDefaultPhoneCountry();
  return <LoginForm defaultCountryCode={defaultCountryCode} />;
}
