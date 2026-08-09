import { LoginForm } from "@/components/LoginForm";
import { getAllUsers } from "@/lib/repository";

export default async function LoginPage() {
  const users = await getAllUsers();
  return <LoginForm users={users} />;
}
