import { useState } from "react";
import UploadPage  from "./pages/UploadPage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";

export default function App() {
  const [page,   setPage]   = useState("upload"); // upload | results | history
  const [result, setResult] = useState(null);
  const [file,   setFile]   = useState(null);

  function handleResult(data) {
    setResult(data);
    setPage("results");
  }

  function handleReset() {
    setResult(null);
    setFile(null);
    setPage("upload");
  }

  if (page === "history") {
    return <HistoryPage onBack={handleReset} />;
  }
  if (page === "results" && result) {
    return <ResultsPage result={result} file={file} onReset={handleReset} />;
  }
  return (
    <UploadPage
      onResult={handleResult}
      onFile={setFile}
      onHistory={() => setPage("history")}
    />
  );
}
