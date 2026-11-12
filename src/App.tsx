import React, { useState, useEffect, useRef } from 'react';
import { Settings, Download, Copy, RefreshCw, X, Type, FileText, CheckCircle2, Moon, Sun } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// @ts-ignore
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';

interface AIModel {
  id: string;
  displayName: string;
}

export default function App() {
  const [apiKey, setApiKey] = useState<string>('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [htmlResult, setHtmlResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);

  // Initialize theme and fetch models
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const fetchModels = async () => {
      try {
        const res = await fetch('https://ss314029.stars.ne.jp/available-api/api.php');
        if (!res.ok) throw new Error('APIモデルの取得に失敗しました');
        const data = await res.json();
        if (data.status === 'success' && data.models) {
          setModels(data.models);
          if (data.models.length > 0) setSelectedModel(data.models[0].id);
        }
      } catch (error: any) {
        toast.error('モデル一覧の取得に失敗しました: ' + error.message);
      }
    };
    fetchModels();

    if (!savedKey) setIsSettingsOpen(true);
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newDark = !prev;
      if (newDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newDark;
    });
  };

  const handleSaveConfig = () => {
    if (!apiKey) {
      toast.error('APIキーを入力してください');
      return;
    }
    localStorage.setItem('gemini_api_key', apiKey);
    setIsSettingsOpen(false);
    toast.success('設定を保存しました');
  };

  const handleTranslate = async () => {
    if (!apiKey) {
      toast.error('AI StudioのAPIキーが設定されていません');
      setIsSettingsOpen(true); return;
    }
    if (!inputText.trim()) { toast.error('日本語の原稿を入力してください'); return; }
    if (!selectedModel) { toast.error('モデルを選択してください'); return; }

    setIsLoading(true);
    setHtmlResult('');
    setExecutionTime(null);
    const tid = toast.loading('翻訳中... しばらくお待ち下さい');
    const startTime = performance.now();

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`;

      const promptText = `あなたはプロの翻訳家および言語学者です。以下の【指示】に厳格に従って処理してください。

【指示】
1. 与えられた日本語テキストを、自然で流暢な「中国語（簡体字）」に翻訳してください。
2. 【重要】元の日本語テキストは絶対に出力・表示しないでください。出力は「翻訳後の中国語」のみにしてください。
3. 翻訳した中国語テキストの「すべての漢字」の直後に、その漢字の拼音（ピンイン）を中括弧 {} で囲んで配置してください。
4. 【多音字の処理】中国語には文脈で発音が変わる多音字があります。必ず文脈を深く理解し、その単語や文脈において最も適切な発音（拼音）を選択してください。
5. 漢字は一つずつ個別に {} を使って拼音を振ってください。（例: 中国 → 中{zhōng}国{guó}）
6. 句読点（、。！？）や記号、数字やアルファベットには決して拼音を振らず、そのまま出力してください。
7. 【超重要】文字と文字、または文字と {} の間に、不要な空白（スペース）や改行を絶対に入れないでください。
8. 出力は「純粋な結果テキストのみ」とし、Markdownのコードブロック（\`\`\` など）や説明文、前置き文は一切追加しないでください。

【出力形式の例】
（悪い例 - 元の日本語が混ざっている）：中{zhōng}国{guó}です。
（悪い例 - 空白が入っている）：中{zhōng} 国{guó}
（良い例 - 中国語のみで空白がない）：中{zhōng}国{guó}，是{shì}...

【入力テキスト】
${inputText.trim()}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'APIリクエストエラーが発生しました');

      let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // クリーニング処理: Markdownの除去
      generatedText = generatedText.replace(/^[\s\n]*\`\`\`(html)?/i, '').replace(/\`\`\`[\s\n]*$/i, '').trim();
      // クリーニング処理: 文字と {pinyin} の間、または } と次の文字の前にある不自然な余白や改行を強制的に削除
      generatedText = generatedText.replace(/\}\s+/g, '}').replace(/\s+\{/g, '{');
      
      // 変換処理: 漢字{pinyin} フォーマットをHTMLの <ruby> タグに置換する
      const processedHtml = generatedText.replace(/(.)\{([^\}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');

      setHtmlResult(processedHtml);
      const endTime = performance.now();
      const elapsedMs = endTime - startTime;
      setExecutionTime(elapsedMs);
      toast.success(`翻訳が完了しました！ (${(elapsedMs / 1000).toFixed(2)}秒)`, { id: tid });

    } catch (err: any) {
      toast.error('エラー: ' + err.message, { id: tid, duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  const exportPDF = () => {
    if (!htmlResult) { toast.error('出力する結果がありません'); return; }
    const element = document.getElementById('pdf-content');
    if (!element) return;
    
    toast.success('PDFを生成しています...');
    const opt = {
      margin: 10,
      filename: 'translated_pinyin.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const copyHtml = () => {
    if (!htmlResult) return;
    navigator.clipboard.writeText(htmlResult).then(() => toast.success('HTMLソースをコピーしました'));
  };

  const copyText = () => {
    if (!resultRef.current) return;
    navigator.clipboard.writeText(resultRef.current.innerText).then(() => toast.success('テキストをコピーしました'));
  };

  const copyPlainChinese = () => {
    if (!htmlResult) return;
    // <rt>タグとその中身を削除し、さらに残りのHTMLタグを取り除くことでプレーンな中国語テキストを得る
    const plainText = htmlResult
      .replace(/<rt>.*?<\/rt>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    
    // innerTextだけだと改行が消える場合があるので、br要素も改行に戻す必要がある場合は
    // .replace(/<br\s*[\/]?>/gi, '\n') をタグ消去の前に入れるなど対応（今回はテキストで \n が維持されている前提）
    navigator.clipboard.writeText(plainText).then(() => toast.success('中国語（ルビなし）をコピーしました'));
  };

  const exportImage = async () => {
    if (!htmlResult) { toast.error('出力する結果がありません'); return; }
    const element = document.getElementById('pdf-content');
    if (!element) return;
    
    toast.success('画像を生成しています...');
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const link = document.createElement('a');
      link.download = 'translated_pinyin.jpg';
      link.href = imgData;
      link.click();
      toast.success('画像を保存しました');
    } catch (err) {
      toast.error('画像の生成に失敗しました');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-slate-800 dark:text-slate-100' }} />
      
      {/* Header */}
      <header className="w-full bg-indigo-600 dark:bg-indigo-800 text-white shadow-md p-4 flex justify-between items-center sm:px-8 transition-colors duration-200">
        <div className="flex items-center space-x-2">
          <Type className="h-6 w-6 font-bold" />
          <h1 className="text-xl font-bold tracking-wider">TransDoc 拼音</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={toggleDarkMode} className="p-2 bg-indigo-500 dark:bg-indigo-700 hover:bg-indigo-400 dark:hover:bg-indigo-600 rounded-full transition relative group" aria-label="Toggle Dark Mode">
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-indigo-500 dark:bg-indigo-700 hover:bg-indigo-400 dark:hover:bg-indigo-600 rounded-full transition relative group" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-5xl flex-grow p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6">
        
        {/* Input Section */}
        <section className="flex-1 flex flex-col bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <h2 className="text-lg font-semibold border-b dark:border-slate-700 pb-2 mb-4 text-slate-700 dark:text-slate-200 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" /> 入力エリア
          </h2>
          
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">使用モデル</label>
          <select 
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition dark:text-slate-200"
            value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
          >
            {models.length === 0 && <option value="">読み込み中...</option>}
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>

          <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">日本語の原稿</label>
          <textarea
            className="w-full flex-grow bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md p-3 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none transition min-h-[250px] dark:text-slate-200"
            placeholder="ここに日本語のテキストを貼り付けてください..."
            value={inputText} onChange={(e) => setInputText(e.target.value)}
          ></textarea>

          <button 
            onClick={handleTranslate} disabled={isLoading}
            className="mt-4 w-full bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-medium py-3 rounded-lg shadow-sm transition flex justify-center items-center disabled:opacity-75"
          >
            {isLoading ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
            {isLoading ? '実行中...' : '翻訳＆ルビ振り実行'}
          </button>
        </section>

        {/* Output Section */}
        <section className="flex-1 flex flex-col bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <div className="flex justify-between items-center border-b dark:border-slate-700 pb-2 mb-4">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mr-4 flex items-center">プレビュー</h2>
              {executionTime !== null && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                  実行時間: {(executionTime / 1000).toFixed(2)}秒
                </span>
              )}
            </div>
            <div className="flex space-x-2 flex-wrap justify-end gap-y-2">
              <button onClick={copyPlainChinese} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition p-1 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-md px-2" title="中国語のみコピー">中</button>
              <button onClick={copyText} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition p-1" title="表示テキスト全体をコピー"><Copy className="h-5 w-5" /></button>
              <button onClick={copyHtml} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition p-1" title="HTMLをコピー"><FileText className="h-5 w-5" /></button>
              <button onClick={exportImage} className="text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-800 p-1 px-3 rounded-md transition flex items-center font-medium text-sm">
                画像保存
              </button>
              <button onClick={exportPDF} className="text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-800 p-1 px-3 rounded-md transition flex items-center font-medium text-sm">
                <Download className="h-4 w-4 mr-1" /> PDF
              </button>
            </div>
          </div>
          <div className="flex-grow overflow-auto relative">
            {!htmlResult && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">実行結果がここに表示されます。</div>
            )}
            <div 
              id="pdf-content" ref={resultRef}
              className="pdf-content-wrapper text-lg leading-loose break-words whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: htmlResult }}
            >
            </div>
          </div>
        </section>

      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">設定</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-red-500 transition"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Google AI Studio API Key</label>
              <input 
                type="text"
                autoComplete="off"
                spellCheck="false"
                data-lpignore="true"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-2 dark:text-slate-200"
                placeholder="AIzaSy..." value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">キーはブラウザのローカルにのみ保存され、外部には送信されません。</p>
              <button onClick={handleSaveConfig} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-md transition">保存して閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
