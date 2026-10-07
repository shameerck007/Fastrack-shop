import RegisterForm from "@/components/RegisterForm";
import { getDefaultPhoneCountry } from "@/lib/get-request-country";

export default async function RegisterPage() {
  const defaultCountryCode = await getDefaultPhoneCountry();
  return <RegisterForm defaultCountryCode={defaultCountryCode} />;
}
