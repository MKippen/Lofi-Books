interface WordCountProps {
  words: number;
  characters: number;
}

export default function WordCount({ words, characters }: WordCountProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-indigo/40">
      <span>Words: {words.toLocaleString()}</span>
      <span className="text-indigo/20">|</span>
      <span>Characters: {characters.toLocaleString()}</span>
    </div>
  );
}
