// The public face of justketchup.vercel.app. There is nothing to sign in to
// here: the app lives on the iPhone, and friends only ever use invite links
// (/m/<token>). Supabase also falls back to this URL after a sign-in whose
// return address it doesn't recognise, so the page says how to get back.
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-center px-6 py-14 max-w-md mx-auto">
      <p className="text-sm font-semibold tracking-wide uppercase text-[#EA580C]">JustKetchup</p>
      <h1 className="mt-3 text-4xl font-bold text-[#1C1917] leading-tight">
        Overdue a ketchup with someone?
      </h1>
      <p className="mt-4 text-lg text-[#57534E] leading-relaxed">
        JustKetchup is an iPhone app that nudges you when it&apos;s been too long, finds a time
        you&apos;re both free and suggests a spot halfway between you.
      </p>

      <div className="mt-10 space-y-3">
        <div className="rounded-2xl bg-white border border-[#E7E5E4] p-5">
          <p className="font-semibold text-[#1C1917]">Got a link from a friend?</p>
          <p className="mt-1 text-[#57534E]">
            Open it from their WhatsApp message. You can pick a time and a place right in your
            browser, no app needed.
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-[#E7E5E4] p-5">
          <p className="font-semibold text-[#1C1917]">Just signed in?</p>
          <p className="mt-1 text-[#57534E]">
            Head back to the JustKetchup app on your iPhone. You can close this page.
          </p>
        </div>
      </div>

      <p className="mt-12 text-sm text-[#A8A29E]">
        <a className="underline" href="/privacy">Privacy</a>
        <span className="mx-2">·</span>
        <a className="underline" href="/terms">Terms</a>
      </p>
    </main>
  )
}
