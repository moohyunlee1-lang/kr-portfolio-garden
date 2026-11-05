import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sanctuaryUrl } from "@/lib/sanctuary";

export const dynamic = "force-dynamic";

export default async function SanctuaryEntry({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  if (!/^\d{6}$/.test(ticker)) notFound();
  const origin = process.env.SANCTUARY_ORIGIN ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8787" : undefined);
  const url = sanctuaryUrl(ticker, origin);
  if (url) redirect(url);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 p-6">
      <h1 className="font-display text-3xl">기도원 연결 준비 중</h1>
      <p>독립 기도원 서비스의 주소가 아직 연결되지 않았습니다. 기존 정원은 계속 이용할 수 있습니다.</p>
      <p className="text-sm text-[#6b5344]">운영자는 SANCTUARY_ORIGIN에 기도원 주소를 설정해 주세요.</p>
      <Link href="/" className="min-h-11 underline">그루밭으로 돌아가기</Link>
    </main>
  );
}
