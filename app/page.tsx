import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl p-8 text-center">
        <div className="text-5xl mb-4">🛎️</div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          디지털 튜터 호출 시스템
        </h1>
        <p className="text-slate-600 mb-8">
          선생님은 호출하고, 디지털 튜터는 실시간으로 확인합니다.
        </p>

        <div className="grid gap-4">
          <Link
            href="/teacher"
            className="block rounded-2xl bg-blue-600 text-white text-xl font-bold py-5 hover:bg-blue-700"
          >
            선생님 호출 화면
          </Link>

          <Link
            href="/tutor"
            className="block rounded-2xl bg-emerald-600 text-white text-xl font-bold py-5 hover:bg-emerald-700"
          >
            디지털 튜터 화면
          </Link>
        </div>
      </div>
    </main>
  );
}