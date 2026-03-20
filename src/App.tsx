import React, { useState, useEffect, useRef } from 'react';
import { Settings, Download, Copy, RefreshCw, X, Type, FileText, CheckCircle2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// @ts-ignore
import html2pdf from 'html2pdf.js';

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

  const resultRef = useRef<HTMLDivElement>(null);

  // Load API Key from local storage and fetch models
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }

    const fetchModels = async () => {
      try {
        const res = await fetch('https://runaaa0712.weblike.jp/MyApp/available-api/api.php');
        if (!res.ok) throw new Error('APIモデルの取得に失敗しました');
        const data = await res.json();
        if (data.status === 'success' && data.models) {
          setModels(data.models);
          if (data.models.length > 0) {
            setSelectedModel(data.models[0].id);
          }
        }
      } catch (error: any) {
        toast.error('モデル一覧の取得に失敗しました: ' + error.message);
      }
    };
    fetchModels();

    // Check if key is prompt needed
    if (!savedKey) {
      setIsSettingsOpen(true);
    }
  }, []);

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
      setIsSettingsOpen(true);
      return;
    }
    if (!inputText.trim()) {
      toast.error('日本語の原稿を入力してください');
      return;
    }
    if (!selectedModel) {
      toast.error('モデルを選択してください');
      return;
    }

    setIsLoading(true);
    setHtmlResult('');
    const tid = toast.loading('翻訳中... しばらくお待ち下さい');

    try {
      // The model id is typically "models/gemini-pro" etc.
      // E.g. https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
      const url = `https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`;

      const promptText = `
あなたは翻訳とピンイン生成のエキスパートです。
以下の日本語テキストを自然な中国語に翻訳してください。
さらに、翻訳後の【すべての漢字に対して】、HTMLの <ruby> タグを使用して拼音（ピンイン）のルビを振ってください。

必ず以下の形式やルールを厳守してください：
- 出力はHTML形式のみにすること。
- Markdownのコードブロック記号（\`\`\`html など）は絶対に含めないでください。先頭にも末尾にも不要です。
- 不要な説明や挨拶などテキストを含めないでください。純粋なHTMLだけを返してください。
- 漢字は中国語の文字体を用い、ルビはピンイン（声調記号付き）にしてください。
例: <ruby>中<rt>zhōng</rt></ruby><ruby>国<rt>guó</rt></ruby>

入力テキスト：
${inputText}
      `.trim();

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'APIリクエストエラーが発生しました');
      }

      let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Remove markdown ticks if AI outputed them anyway
      generatedText = generatedText.replace(/^[\s\n]*\`\`\`(html)?/i, '').replace(/\`\`\`[\s\n]*$/i, '').trim();

      setHtmlResult(generatedText);
      toast.success('翻訳が完了しました！', { id: tid });

    } catch (err: any) {
      toast.error('エラー: ' + err.message, { id: tid, duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  const exportPDF = () => {
    if (!htmlResult) {
      toast.error('出力する結果がありません');
      return;
    }
    const element = document.getElementById('pdf-content');
    if (!element) return;
    
    toast.success('PDFを生成しています...');
    const opt = {
      margin:       10,
      filename:     'translated_pinyin.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const copyHtml = () => {
    if (!htmlResult) return;
    navigator.clipboard.writeText(htmlResult).then(() => {
      toast.success('HTMLソースをコピーしました');
    });
  };

  const copyText = () => {
    if (!resultRef.current) return;
    const text = resultRef.current.innerText;
    navigator.clipboard.writeText(text).then(() => {
      toast.success('テキストをコピーしました');
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-50 text-slate-800">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="w-full bg-indigo-600 text-white shadow-md p-4 flex justify-between items-center sm:px-8">
        <div className="flex items-center space-x-2">
          <Type className="h-6 w-6 font-bold" />
          <h1 className="text-xl font-bold tracking-wider">TransDoc 拼音</h1>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 bg-indigo-500 hover:bg-indigo-400 rounded-full transition relative group"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
          <span className="absolute right-0 top-10 w-24 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">
            設定 (API Key)
          </span>
        </button>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-5xl flex-grow p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6">
        
        {/* Input Section */}
        <section className="flex-1 flex flex-col bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4 text-slate-700 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-indigo-500" />
            入力エリア
          </h2>
          
          <label className="text-sm font-medium text-slate-600 mb-1">使用モデル</label>
          <select 
            className="w-full bg-slate-50 border border-slate-300 rounded-md py-2 px-3 mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {models.length === 0 && <option value="">読み込み中...</option>}
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>

          <label className="text-sm font-medium text-slate-600 mb-1">日本語の原稿</label>
          <textarea
            className="w-full flex-grow bg-slate-50 border border-slate-300 rounded-md p-3 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none transition min-h-[250px]"
            placeholder="ここに日本語のテキストを貼り付けてください..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          ></textarea>

          <button 
            onClick={handleTranslate}
            disabled={isLoading}
            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg shadow-sm transition flex justify-center items-center disabled:opacity-75"
          >
            {isLoading ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
            {isLoading ? '実行中...' : '翻訳＆ルビ振り実行'}
          </button>
        </section>

        {/* Output Section */}
        <section className="flex-1 flex flex-col bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center border-b pb-2 mb-4">
            <h2 className="text-lg font-semibold text-slate-700 flex items-center">
              プレビュー
            </h2>
            <div className="flex space-x-2">
              <button 
                onClick={copyText}
                className="text-slate-500 hover:text-indigo-600 transition p-1"
                title="テキストをコピー"
              >
                <Copy className="h-5 w-5" />
              </button>
              <button 
                onClick={copyHtml}
                className="text-slate-500 hover:text-indigo-600 transition p-1"
                title="HTMLをコピー"
              >
                <FileText className="h-5 w-5" />
              </button>
              <button 
                onClick={exportPDF}
                className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-1 px-3 rounded-md transition flex items-center font-medium text-sm"
              >
                <Download className="h-4 w-4 mr-1" /> PDF
              </button>
            </div>
          </div>
          
          <div className="flex-grow overflow-auto relative">
            {!htmlResult && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                実行結果がここに表示されます。
              </div>
            )}
            <div 
              id="pdf-content"
              ref={resultRef}
              className="pdf-content-wrapper text-lg leading-loose break-words"
              dangerouslySetInnerHTML={{ __html: htmlResult }}
            >
            </div>
          </div>
        </section>

      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">設定</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-red-500 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Google AI Studio API Key
              </label>
              <input 
                type="password"
                className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-2"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-slate-500 mb-6">
                キーはブラウザのローカルにのみ保存され、外部には送信されません。（GoogleのAPI通信時を除く）
              </p>
              <button 
                onClick={handleSaveConfig}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-md transition"
              >
                保存して閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
