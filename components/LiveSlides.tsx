// components/LiveSlides.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

type Slide = { src: string; alt?: string };

interface Props {
  roomId: string;
  slides: Slide[];
  isPresenter: boolean;
}

export default function LiveSlides({ roomId, slides, isPresenter }: Props) {
  const [index, setIndex] = useState(0);
  const [liveFollow, setLiveFollow] = useState(true); // toggle para “desincronizar”
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const userKey = useMemo(
    () => `u_${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  useEffect(() => {
    const channel = supabase.channel(`slides:${roomId}`, {
      config: { presence: { key: userKey } },
    });
    channelRef.current = channel;

    // Broadcast: recibir cambio de diapositiva
    channel.on("broadcast", { event: "slide" }, (payload) => {
      if (!liveFollow) return;
      const next = Number(payload.payload?.index ?? 0);
      if (!Number.isNaN(next)) setIndex(bound(next));
    });

    // Presence: al sincronizar presencia, tomar el índice del presentador (si hay)
    channel.on("presence", { event: "sync" }, () => {
      if (isPresenter) return; // los asistentes solo leen
      const state = channel.presenceState();
      // Buscar cualquier presentador y tomar su index más reciente
      const presenters = Object.values(state)
        .flat()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => p?.role === "presenter");
      // Si hay varios, tomar el índice más alto (último)
      const latestIdx =
        presenters.length > 0
          ? Math.max(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...presenters.map((p: any) =>
                typeof p?.index === "number" ? p.index : 0
              )
            )
          : 0;
      setIndex(bound(latestIdx));
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Reportar presencia
        channel.track({
          role: isPresenter ? "presenter" : "viewer",
          index,
        });

        // Si soy presentador, emito el índice al entrar para sincronizar a los nuevos
        if (isPresenter) {
          channel.send({
            type: "broadcast",
            event: "slide",
            payload: { index },
          });
        }
      }
    });

    // Limpieza
    return () => {
      channel?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isPresenter, userKey]);

  // Actualizar presence cuando el presentador cambia index
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    if (isPresenter) {
      channel.track({ role: "presenter", index }).catch(() => {});
    }
  }, [index, isPresenter]);

  // Atajos de teclado para el presentador
  useEffect(() => {
    if (!isPresenter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") next();
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPresenter, index]);

  const bound = (i: number) => Math.max(0, Math.min(slides.length - 1, i));
  const go = (i: number) => setIndex(bound(i));

  const broadcast = (i: number) => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.send({ type: "broadcast", event: "slide", payload: { index: i } });
  };

  const next = () => {
    const i = bound(index + 1);
    setIndex(i);
    if (isPresenter) broadcast(i);
  };

  const prev = () => {
    const i = bound(index - 1);
    setIndex(i);
    if (isPresenter) broadcast(i);
  };

  const reSync = () => {
    setLiveFollow(true);
    const channel = channelRef.current;
    if (!channel) return;
    // Pedir “estado actual” al presentador: basta con que el presentador esté
    // actualizando presence; igual emitimos una petición implícita reenviando nuestra presencia
    channel
      .track({ role: isPresenter ? "presenter" : "viewer", index })
      .catch(() => {});
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center gap-4 p-4">
      <header className="w-full max-w-4xl flex items-center justify-between">
        <div className="text-sm opacity-80">
          Sala: <span className="font-mono">{roomId}</span> • Diapositiva{" "}
          {index + 1}/{slides.length}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={liveFollow}
              onChange={(e) => setLiveFollow(e.target.checked)}
            />
            Seguir en vivo
          </label>
          {!liveFollow && (
            <button
              className="px-3 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm"
              onClick={reSync}
            >
              Re-sincronizar
            </button>
          )}
        </div>
      </header>

      <main className="w-full max-w-4xl">
        <div className="w-full aspect-video relative rounded-2xl overflow-hidden bg-neutral-900">
          {/* Usar next/image para optimización (si tus URLs permiten) */}
          <Image
            src={slides[index].src}
            alt={slides[index].alt || `Slide ${index + 1}`}
            fill
            unoptimized
            style={{ objectFit: "contain" }}
            priority
          />
        </div>
      </main>

      <footer className="w-full max-w-4xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700"
            onClick={prev}
            aria-label="Anterior"
          >
            ← Anterior
          </button>
          <button
            className="px-4 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700"
            onClick={next}
            aria-label="Siguiente"
          >
            Siguiente →
          </button>
        </div>
        {/* {isPresenter ? (
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700"
              onClick={prev}
              aria-label="Anterior"
            >
              ← Anterior
            </button>
            <button
              className="px-4 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700"
              onClick={next}
              aria-label="Siguiente"
            >
              Siguiente →
            </button>
          </div>
        ) : (
          <div className="text-sm opacity-70"></div>
        )} */}

        {/* {isPresenter && (
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm"
              onClick={() => {
                // re-emite la diapositiva actual (por si alguien se unió tarde)
                broadcast(index);
              }}
            >
              Reemitir diapositiva
            </button>
          </div>
        )} */}
      </footer>
    </div>
  );
}
