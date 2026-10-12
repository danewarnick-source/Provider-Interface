import { DuskPeopleScreen } from "@/components/pi-landing/dusk-people-screen";

/**
 * Composed desk scene: photographic desk plate + Denim laptop still. Not an app iframe.
 *
 * The laptop is in normal document flow so its height reserves space. The desk
 * photo is a covering backdrop. Absolute-positioning the mock over a short
 * photo used to let it overflow into the next section and cover the copy.
 */
export function DuskDeskStill() {
  return (
    <div className="relative mx-auto w-full max-w-[92rem]">
      <img
        src="/pi-dusk-desk-hero.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_62%]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--denim-bg)] via-[var(--denim-bg)]/40 to-[var(--denim-bg)]/80" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--denim-bg)] to-transparent" />

      <div className="relative flex justify-center px-4 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-12">
        <div
          className="w-full max-w-[920px]"
          style={{
            transform: "perspective(1600px) rotateX(8deg)",
            transformStyle: "preserve-3d",
          }}
        >
          <div className="rounded-[16px] bg-paper p-[6px] shadow-[var(--denim-shadow),0_40px_80px_-30px_rgba(27,51,80,0.45)] sm:p-[8px]">
            <div className="overflow-hidden rounded-[11px] bg-[var(--denim-bg)] ring-1 ring-line">
              <div className="aspect-[16/9.2] min-h-[200px] max-h-[520px]">
                <DuskPeopleScreen />
              </div>
            </div>
            <div className="mx-auto mt-1.5 h-1 w-10 rounded-full bg-pt2 sm:mt-2 sm:h-1.5 sm:w-14" />
          </div>
        </div>
      </div>
    </div>
  );
}
