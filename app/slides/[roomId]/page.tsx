import { slides } from "@/data/slides";
import LiveSlides from "@/components/LiveSlides";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ presenter?: string }>;
}) {
  const { roomId } = await params;
  const { presenter } = await searchParams;

  const isPresenter =
    typeof presenter !== "undefined" &&
    ["1", "true", "yes"].includes(String(presenter).toLowerCase());

  return (
    <LiveSlides roomId={roomId} slides={slides} isPresenter={isPresenter} />
  );
}
