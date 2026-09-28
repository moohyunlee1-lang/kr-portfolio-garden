export function BootScreen({ label = "정원으로 들어가는 중" }: { label?: string }) {
  return (
    <div className="grid h-dvh place-items-center bg-[#efe4d2] text-[#6b5344]">
      <p>{label}</p>
    </div>
  );
}
