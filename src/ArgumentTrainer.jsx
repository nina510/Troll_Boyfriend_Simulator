import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Trophy,
  RefreshCw,
  Send,
  AlertCircle,
  Heart,
  ArrowRight,
} from "lucide-react";

/* Level Configuration */
const LEVEL_CONFIG = {
  1: {
    title: "Level 1: 初级杠精",
    description: "逻辑漏洞百出，喜欢用土味情话掩饰，比较好怼。",
    personaPrompt:
      "有点大男子主义，喜欢讲大道理但逻辑漏洞明显，偶尔会用土味情话掩饰尴尬，容易破防。",
  },
  2: {
    title: "Level 2: 资深逻辑怪",
    description: "善于抓语病，冷静且理智，不容易被情绪带着走。",
    personaPrompt:
      "思维缜密，喜欢抠字眼，善于发现对方逻辑中的漏洞，语气冷静带点优越感，不会轻易生气，这时候你更像个理科男。",
  },
  3: {
    title: "Level 3: 终极诡辩家",
    description: "擅长把小事上升到价值观，胡搅蛮缠但听起来很有道理。",
    personaPrompt:
      "哲学诡辩大师，擅长把生活琐事上升到社会议题、性别对立或者宇宙哲学层面，胡搅蛮缠但词汇量丰富，让人在大脑短路的同时感到愤怒。",
  },
};

/* Base System Prompt */
const BASE_SYSTEM_PROMPT = `
你现在是一个角色扮演游戏引擎。
角色设定：
1. "男友" (AI): [PERSONA_PLACEHOLDER]
2. "女友" (User): 聪明、犀利、女王范。
3. "教练" (AI Judge): 毒舌但专业的辩论教练。

游戏流程：
1. 男友说出一句有点找茬或令人无语的话。
2. 用户输入回击。
3. 你必须返回一个 JSON 对象，包含：
    - score: (0-20分) 评价用户的回击。
    - critique: (字符串) 教练的简短点评，分析回击的精彩之处或不足之处。
    - advice: (字符串) 如果得分低，给一句如何回怼更好的建议。
    - reaction: (字符串) 男友听到回击后的反应（心理活动或表情描述，要好笑）。
    - reply: (字符串) 男友的下一句回嘴（继续抬杠，或者试图找补）。

请注意：输出必须是严格的 JSON 格式。不要包含 markdown 代码块标记。
语言风格：幽默、网络流行语、情景喜剧感。
`;

const ArgumentTrainer = () => {
  const [gameState, setGameState] = useState("intro"); // intro, playing, won, lost
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [history, setHistory] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState("");
  const chatEndRef = useRef(null);
  const [combo, setCombo] = useState(0);

  // API Key Handling
  const apiKey = "AIzaSyCAFR7iNMCO_OA-UF3Rz-BI8W03S6AiBNU"; // Runtime environment provides this

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, loading]);

  // Helper to generate initial topic dynamically based on level
  const generateInitialTopic = async (currentLevel) => {
    setLoading(true);
    try {
      const levelPersona = LEVEL_CONFIG[currentLevel].personaPrompt;
      const prompt = `
                你现在是一个角色扮演游戏引擎。
                角色设定："男友" (AI): ${levelPersona}
                任务：生成一句该角色的开场白，用来挑起争论。
                难度要求：
                - 如果是Level 1，话题可以是乱花钱、开车技术等生活琐事，语气欠揍。
                - 如果是Level 2，话题可以是关于效率、逻辑、规划等，语气理智冷漠。
                - 如果是Level 3，话题可以是关于自由意志、消费主义宏大叙事、或者极度双标的哲学观点。
                
                要求：
                1. 只返回这一句话的纯文本。
                2. 不要包含JSON，不要包含引号。
                3. 语气要符合当前等级的人设。
                4. 确保话题每次都尽量随机。
            `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text || "你看看你，整天就知道抱着个手机，眼里还有这个家吗？";
    } catch (error) {
      console.error("Topic Gen Error", error);
      return "你看看你，整天就知道抱着个手机，眼里还有这个家吗？";
    } finally {
      setLoading(false);
    }
  };

  // Start Game (can be specific level or restart)
  const startGame = async (targetLevel = 1) => {
    setGameState("playing");
    setScore(0);
    setLevel(targetLevel);
    setHistory([]);
    setCombo(0);

    // Generate the topic via AI for the specific level
    const topic = await generateInitialTopic(targetLevel);
    setHistory([{ role: "ai", text: topic, type: "text" }]);
    setCurrentTopic(topic);
  };

  // Helper to call Gemini for replies
  const callGemini = async (userReply, contextHistory) => {
    setLoading(true);
    try {
      // Inject level persona into prompt
      const levelPersona = LEVEL_CONFIG[level].personaPrompt;
      const systemPrompt = BASE_SYSTEM_PROMPT.replace(
        "[PERSONA_PLACEHOLDER]",
        levelPersona
      );

      // Filter out feedback items for the prompt context
      const cleanHistory = contextHistory.filter((h) => h.type === "text");
      const historyText = cleanHistory
        .map((h) => `${h.role === "ai" ? "男友" : "女友"}: ${h.text}`)
        .join("\n");

      const prompt = `
                ${systemPrompt}
                
                当前难度等级: Level ${level}
                
                当前对话历史:
                ${historyText}
                
                女友的回击: "${userReply}"
                
                请根据以上内容生成 JSON 响应。
            `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!resultText) throw new Error("No response");

      return JSON.parse(resultText);
    } catch (error) {
      console.error("API Error", error);
      return {
        score: 5,
        critique: "哎呀，裁判走神了（网络错误）。",
        advice: "再说一遍试试？",
        reaction: "假装没听见",
        reply: "你说啥？我刚才信号不好。",
      };
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg = { role: "user", text: inputText, type: "text" };
    const currentHistory = [...history, userMsg];
    setHistory(currentHistory);
    setInputText("");

    const aiResponse = await callGemini(inputText, currentHistory);

    const points = aiResponse.score;
    const newScore = Math.min(score + points, 100);
    setScore(newScore);

    if (points >= 15) {
      setCombo((prev) => prev + 1);
    } else {
      setCombo(0);
    }

    const feedbackMsg = { type: "feedback", data: aiResponse };
    setHistory((prev) => [...prev, feedbackMsg]);

    setTimeout(() => {
      setHistory((prev) => [
        ...prev,
        {
          role: "ai",
          text: aiResponse.reply,
          type: "text",
          reaction: aiResponse.reaction,
        },
      ]);

      if (newScore >= 100) {
        setTimeout(() => {
          setGameState("won");
        }, 3500);
      }
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Components ---

  const ProgressBar = ({ value }) => (
    <div className="w-full bg-gray-200 rounded-full h-6 border-2 border-black relative overflow-hidden">
      <div
        className={`h-full transition-all duration-500 ease-out ${
          value > 80
            ? "bg-red-500"
            : value > 50
            ? "bg-yellow-400"
            : "bg-blue-400"
        }`}
        style={{ width: `${value}%` }}
      >
        <div
          className="w-full h-full opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)",
            backgroundSize: "1rem 1rem",
          }}
        ></div>
      </div>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-black tracking-widest text-black/70">
        WINNING PROGRESS: {value}%
      </span>
    </div>
  );

  const FeedbackCard = ({ data }) => {
    if (!data) return null;
    return (
      // Added text-left to ensure proper alignment in CodeSandbox
      <div className="my-4 mx-auto w-full max-w-[90%] md:max-w-[80%] bg-yellow-100 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-300 text-left">
        <div className="flex justify-between items-start mb-2 border-b-2 border-black/10 pb-2">
          <h3 className="font-black text-sm md:text-lg uppercase flex items-center gap-2 text-purple-700">
            <Zap size={20} className="fill-current" />
            Round Analysis
          </h3>
          <div className="text-xl md:text-2xl font-black bg-black text-white px-2 py-1 transform rotate-3">
            +{data.score} PTS
          </div>
        </div>

        <div className="space-y-2 text-sm font-bold text-gray-800 font-mono">
          <p>
            <span className="bg-blue-200 px-1 text-black border border-black text-xs">
              点评
            </span>{" "}
            {data.critique}
          </p>
          {data.score < 15 && (
            <p>
              <span className="bg-green-200 px-1 text-black border border-black text-xs">
                建议
              </span>{" "}
              {data.advice}
            </p>
          )}
          <div className="mt-3 pt-2 border-t border-dashed border-black/20 flex items-center gap-2 text-gray-600 italic text-xs">
            <span>男友内心OS:</span>
            <span>"{data.reaction}"</span>
          </div>
        </div>
      </div>
    );
  };

  const ChatMessage = ({ msg }) => {
    const isUser = msg.role === "user";
    return (
      <div
        className={`flex w-full mb-6 ${
          isUser ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`flex max-w-[85%] md:max-w-[70%] items-end gap-2 ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {/* Avatar */}
          <div
            className={`w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full border-2 border-black flex items-center justify-center overflow-hidden bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}
          >
            {isUser ? (
              <span className="text-2xl" role="img" aria-label="woman">
                👩‍🎤
              </span>
            ) : (
              <span className="text-2xl" role="img" aria-label="man">
                {level === 1 ? "🧔‍♂️" : level === 2 ? "🧐" : "🧙‍♂️"}
              </span>
            )}
          </div>

          {/* Bubble */}
          {/* Added text-left to override any parent centering */}
          <div
            className={`
                        relative p-3 md:p-4 border-2 border-black text-sm md:text-base font-medium shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-left
                        ${
                          isUser
                            ? "bg-pink-300 rounded-l-xl rounded-tr-xl rounded-br-none"
                            : "bg-cyan-200 rounded-r-xl rounded-tl-xl rounded-bl-none"
                        }
                    `}
          >
            {msg.text}
            {!isUser && msg.reaction && (
              <div className="absolute -top-3 -right-2 bg-yellow-300 text-[10px] px-2 border border-black transform rotate-6 shadow-sm whitespace-nowrap hidden md:block">
                {msg.reaction.slice(0, 10)}...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Screens ---

  if (gameState === "intro") {
    return (
      <div className="min-h-screen bg-yellow-50 flex flex-col items-center justify-center p-4 font-sans text-gray-900">
        <div className="max-w-md w-full bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
          <div className="mb-6 flex justify-center">
            <div className="bg-red-500 text-white font-black text-5xl p-4 border-4 border-black transform -rotate-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]">
              VS
            </div>
          </div>
          <h1 className="text-4xl font-black mb-2 uppercase tracking-tighter">
            抬杠模拟器
          </h1>
          <p className="text-lg font-bold text-gray-600 mb-6 font-mono">
            THE ULTIMATE ROAST TRAINER
          </p>

          <div className="space-y-4 text-left mb-8 bg-gray-100 p-4 border-2 border-black border-dashed">
            {Object.entries(LEVEL_CONFIG).map(([lvl, config]) => (
              <div
                key={lvl}
                className="p-2 hover:bg-white transition-colors cursor-default"
              >
                <p className="font-bold text-lg">{config.title}</p>
                <p className="text-sm text-gray-600">{config.description}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => startGame(1)}
            className="w-full bg-black text-white text-xl font-black py-4 border-2 border-black hover:bg-gray-800 hover:translate-y-1 hover:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(128,128,128,1)] active:translate-y-1 active:shadow-none"
          >
            START LEVEL 1
          </button>
        </div>
      </div>
    );
  }

  if (gameState === "won") {
    return (
      <div className="min-h-screen bg-pink-400 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 2px, transparent 2.5px)",
            backgroundSize: "20px 20px",
          }}
        ></div>

        <div className="max-w-md w-full bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center relative z-10 animate-bounce-in">
          <Trophy
            size={64}
            className="mx-auto text-yellow-400 drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-4"
          />
          <h1 className="text-4xl font-black mb-4">VICTORY!</h1>
          <p className="text-xl font-bold mb-2">Level {level} Completed!</p>
          <p className="bg-gray-100 p-4 border-2 border-black mb-8 italic text-gray-600">
            男友已经被你怼得说不出话了...
          </p>

          <div className="space-y-3">
            {level < 3 ? (
              <button
                onClick={() => startGame(level + 1)}
                className="flex items-center justify-center gap-2 w-full bg-yellow-400 text-black text-lg font-black py-3 border-2 border-black hover:bg-yellow-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                挑战下一关 (Level {level + 1}) <ArrowRight size={20} />
              </button>
            ) : (
              <div className="bg-purple-100 p-4 border-2 border-black font-bold text-purple-800 mb-4">
                恭喜你通关了所有难度！你已经是吵架之神了！
              </div>
            )}

            <button
              onClick={() => startGame(1)}
              className="flex items-center justify-center gap-2 w-full bg-blue-500 text-white text-lg font-black py-3 border-2 border-black hover:bg-blue-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              <RefreshCw size={20} /> 从头开始 (Level 1)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dots bg-gray-50 flex flex-col items-center font-sans text-gray-900 max-w-2xl mx-auto border-x-4 border-black shadow-2xl relative">
      {/* Header */}
      <header className="w-full bg-white border-b-4 border-black p-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="bg-black text-white p-1 rounded font-black text-xs">
            VS
          </div>
          <span className="font-bold truncate">
            {LEVEL_CONFIG[level].title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {combo > 1 && (
            <span className="animate-pulse font-black text-orange-500 italic mr-2">
              {combo} COMBO!
            </span>
          )}
          <button
            onClick={() => startGame(level)}
            className="p-1 hover:bg-gray-100 rounded border border-transparent hover:border-black transition-colors"
            title="Restart Level"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* Scoreboard */}
      <div className="w-full bg-white p-3 border-b-4 border-black sticky top-[56px] z-20 shadow-sm">
        <div className="flex justify-between text-xs font-black mb-1">
          <span>ARGUMENT INTENSITY</span>
          <span>{score}/100</span>
        </div>
        <ProgressBar value={score} />
      </div>

      {/* Chat Area */}
      <div className="flex-1 w-full overflow-y-auto p-4 pb-32 bg-[#fffbf0] relative">
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        ></div>

        <div className="relative z-10 space-y-6">
          {history.map((msg, idx) => (
            <React.Fragment key={idx}>
              {msg.type === "feedback" ? (
                <FeedbackCard data={msg.data} />
              ) : (
                <ChatMessage msg={msg} />
              )}
            </React.Fragment>
          ))}

          {loading && (
            <div className="flex justify-start w-full animate-pulse">
              <div className="bg-gray-200 rounded-xl p-3 text-xs font-mono text-gray-500 border-2 border-black/20">
                对方正在组织语言(狡辩)...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area (Fixed Bottom) */}
      <div className="w-full bg-white border-t-4 border-black p-4 fixed bottom-0 max-w-2xl z-30">
        <div className="flex gap-2 items-end">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Level ${level} 挑战中...输入神回击`}
            className="flex-1 bg-gray-50 border-2 border-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-black resize-none h-14 min-h-[56px] font-medium text-sm md:text-base"
            disabled={loading || score >= 100}
          />
          <button
            onClick={handleSend}
            disabled={loading || !inputText.trim() || score >= 100}
            className={`
                            h-14 px-4 bg-black text-white rounded-lg border-2 border-black
                            font-black tracking-wide flex items-center justify-center gap-2
                            transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                            hover:bg-gray-800 shadow-[2px_2px_0px_0px_rgba(128,128,128,1)]
                        `}
          >
            <Send size={20} />
            <span className="hidden md:inline">反击</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArgumentTrainer;
