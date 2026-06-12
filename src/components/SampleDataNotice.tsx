/** Shown when pages render bundled sample data instead of live Testiny. */
export function SampleDataNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span className="font-semibold">Sample data.</span> Set{" "}
      <code className="rounded bg-amber-100 px-1 py-0.5 text-[12px]">
        TESTINY_API_KEY
      </code>{" "}
      in the environment to show live numbers from Testiny.
    </div>
  );
}
