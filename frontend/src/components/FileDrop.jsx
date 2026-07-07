import { useRef, useState } from "react";

/** Apple-style drag & drop file selector. */
export default function FileDrop({ file, onSelect, accent = "ocean", hint }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const ring = dragOver
    ? accent === "timber"
      ? "border-timber bg-timber/5"
      : "border-ocean bg-ocean/5"
    : "border-hairline hover:border-subtle";

  const handleFiles = (files) => {
    if (files && files[0]) onSelect(files[0]);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${ring}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mb-1 text-3xl">📄</div>
      {file ? (
        <p className={accent === "timber" ? "text-timber" : "text-ocean"}>📎 {file.name}</p>
      ) : (
        <p className="text-sm text-subtle">{hint || "Click or drop a file"}</p>
      )}
    </div>
  );
}
