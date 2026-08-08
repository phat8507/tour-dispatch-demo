import { login } from "../actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const inputClassName =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:text-sm";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6">
      <form
        action={login}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-slate-950">Đăng nhập</h1>
          <p className="text-sm text-slate-600">Điều phối tour nhân viên</p>
        </div>
        {error === "invalid" && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Thông tin đăng nhập không hợp lệ.
          </p>
        )}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-800">
            Tên đăng nhập
            <input className={inputClassName} name="username" autoComplete="username" required />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Mật khẩu
            <input className={inputClassName} name="password" type="password" autoComplete="current-password" required />
          </label>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:bg-blue-800"
        >
          Đăng nhập
        </button>
      </form>
    </main>
  );
}
