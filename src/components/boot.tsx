export function BootScreen({ label = "밭으로 들어가는 중" }: { label?: string }) {
  return (
    <div className="grid h-dvh place-items-center bg-[#f6efe2] px-6 text-[#3a3228]">
      <div className="flex flex-col items-center text-center">
        <img src="/groubat.jpg" alt="그루밭" className="mb-4 w-56 max-w-[70vw]" />
        <p className="font-display text-5xl leading-none">그루밭</p>
        <p className="mt-2 text-sm text-[#6d6256]">{label}</p>
      </div>
    </div>
  );
}
