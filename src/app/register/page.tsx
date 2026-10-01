import RegisterForm from "@/components/RegisterForm";
import { getRequestCountryCode } from "@/lib/get-request-country";

export default async function RegisterPage() {
  const defaultCountryCode = await getRequestCountryCode();
  return <RegisterForm defaultCountryCode={defaultCountryCode} />;
}
