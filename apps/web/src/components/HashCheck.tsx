'use client';

import { sha256Hex } from '@preuvio/shared';
import { useState } from 'react';

type Result = 'same' | 'different' | null;

/** Compare le fichier reçu à l'empreinte du PDF d'origine, sans l'envoyer : calcul local. */
export function HashCheck({ expected }: { expected: string }) {
  const [result, setResult] = useState<Result>(null);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="font-bold">Comparer un fichier PDF</span>
        <input
          type="file"
          accept="application/pdf"
          className="min-h-12"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return setResult(null);
            const hash = await sha256Hex(await file.arrayBuffer());
            setResult(hash === expected ? 'same' : 'different');
          }}
        />
      </label>
      <p className="text-base text-text-muted">
        Le fichier reste sur votre appareil : seule son empreinte est calculée.
      </p>
      {result === 'same' ? (
        <p role="status" className="text-xl font-bold text-ok">
          Document intact : identique à l’original.
        </p>
      ) : null}
      {result === 'different' ? (
        <p role="alert" className="text-xl font-bold text-ko">
          Document différent de l’original : il a été modifié ou n’est pas le bon fichier.
        </p>
      ) : null}
    </div>
  );
}
