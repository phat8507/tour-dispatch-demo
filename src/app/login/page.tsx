import { login } from "../actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <form action={login} className="w-full space-y-4 rounded border p-6">
        <h1 className="text-xl font-semibold">Đăng nhập</h1>
        {error === "invalid" && <p role="alert">Thông tin đăng nhập không hợp lệ.</p>}
        <label className="block">Tên đăng nhập<input className="mt-1 w-full border p-2" name="username" required /></label>
        <label className="block">Mật khẩu<input className="mt-1 w-full border p-2" name="password" type="password" required /></label>
        <button className="rounded bg-blue-600 px-4 py-2 text-white">Đăng nhập</button>
      </form>
    </main>
  );
}
