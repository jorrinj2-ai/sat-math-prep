"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { QUESTIONS, CATS, DIFFS, rawToScaled, PRESET_EXAMS } from "@/lib/questions";
import MathText from "@/components/MathText";
import QuestionChart from "@/components/QuestionChart";

// ── Utilities ──────────────────────────────────────────────────
function shuffle(a) { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=0|Math.random()*(i+1);[b[i],b[j]]=[b[j],b[i]];} return b; }
function fmtTime(s) { return `${0|s/60}:${String(s%60).padStart(2,"0")}`; }
function fmtDate(d) { return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function scoreColor(p) { return p>=80?"#22c55e":p>=60?"#eab308":"#ef4444"; }
function gradeOf(p) { return p>=90?{g:"A",c:"#22c55e"}:p>=80?{g:"B",c:"#84cc16"}:p>=70?{g:"C",c:"#eab308"}:p>=60?{g:"D",c:"#f97316"}:{g:"F",c:"#ef4444"}; }

// ── Shared Components ──────────────────────────────────────────
function ProgressRing({pct,size=90,stroke=7,color}) {
  const r=(size-stroke)/2, c=2*Math.PI*r;
  return <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a2332" strokeWidth={stroke}/>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
      strokeDasharray={c} strokeDashoffset={c-(pct/100)*c} strokeLinecap="round"
      style={{transition:"stroke-dashoffset 0.8s ease"}}/>
  </svg>;
}
function Pill({children,color="#64748b",style={}}) {
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:700,background:color+"18",color,...style}}>{children}</span>;
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════
const T = {
  page:{minHeight:"100vh",background:"#0c1421",color:"#e2e8f0",fontFamily:"'Outfit',sans-serif",padding:"20px 16px",boxSizing:"border-box"},
  wrap:{maxWidth:1000,margin:"0 auto"},
  card:{background:"#111c2e",borderRadius:14,border:"1px solid #1a2744",padding:22,marginBottom:16},
  cardH:{fontSize:12,fontWeight:700,color:"#5a7a9e",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14},
  btn:{padding:"10px 22px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,fontFamily:"'Outfit',sans-serif",transition:"all 0.15s"},
  pri:{background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#1a0a00",boxShadow:"0 4px 20px rgba(245,158,11,0.25)"},
  sec:{background:"#162033",color:"#8ba4c4",border:"1px solid #1e3050"},
  dan:{background:"#162033",color:"#f87171",border:"1px solid #7f1d1d"},
  inp:{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #1e3050",background:"#0c1421",color:"#e2e8f0",fontSize:15,fontFamily:"'Outfit',sans-serif",outline:"none",boxSizing:"border-box"},
  big:{fontSize:34,fontWeight:800,letterSpacing:"-0.03em",lineHeight:1},
  sub:{fontSize:12,color:"#5a7a9e",marginTop:4},
  nav:{display:"flex",gap:6,marginBottom:24,flexWrap:"wrap"},
  navBtn:(active)=>({padding:"8px 18px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"'Outfit',sans-serif",background:active?"#f59e0b":"#162033",color:active?"#1a0a00":"#8ba4c4",transition:"all 0.15s"}),
  grid:{display:"grid",gap:16},
};

// ═══════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function SATApp() {
  // Auth state
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [allProfiles, setAllProfiles] = useState([]);
  const [results, setResults] = useState([]);
  const [exams, setExams] = useState([]);

  // View
  const [view, setView] = useState("login");

  // Auth form
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Exam state
  const [examQs, setExamQs] = useState([]);
  const [curQ, setCurQ] = useState(0);
  const [ans, setAns] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [examDone, setExamDone] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [activeExamId, setActiveExamId] = useState(null);
  const timerRef = useRef(null);

  // Admin create exam
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamTime, setNewExamTime] = useState(35);
  const [newExamCats, setNewExamCats] = useState({Algebra:true,"Advanced Math":true,"Problem Solving":true,Geometry:true});
  const [newExamDiffs, setNewExamDiffs] = useState({Easy:true,Medium:true,Hard:true});
  const [newExamCount, setNewExamCount] = useState(22);

  // Analytics
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ── Auth listener ────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadProfile(s.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id);
      else { setProfile(null); setView("login"); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load profile + data ──────────────
  async function loadProfile(userId) {
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (prof) {
      setProfile(prof);
      setView(prof.role === "admin" ? "adminHome" : "studentHome");
      await loadData(prof);
    }
    setLoading(false);
  }

  async function loadData(prof) {
    // Load exams
    const { data: ex } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
    setExams([...(PRESET_EXAMS || []), ...(ex || [])]);

    // Load results (RLS handles filtering)
    const { data: res } = await supabase.from("results").select("*").order("created_at", { ascending: true });
    setResults(res || []);

    // If admin, load all profiles
    if (prof?.role === "admin") {
      const { data: profs } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
      setAllProfiles(profs || []);
    }
  }

  // ── Sign up ──────────────────────────
  async function handleSignUp() {
    if (!fullName.trim()) { setAuthErr("Please enter your name"); return; }
    if (!email.trim()) { setAuthErr("Please enter your email"); return; }
    if (password.length < 6) { setAuthErr("Password must be at least 6 characters"); return; }
    setAuthLoading(true); setAuthErr("");
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: fullName.trim(), role: "student" } }
    });
    if (error) setAuthErr(error.message);
    setAuthLoading(false);
  }

  // ── Sign in ──────────────────────────
  async function handleSignIn() {
    if (!email.trim() || !password) { setAuthErr("Please fill in all fields"); return; }
    setAuthLoading(true); setAuthErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthErr(error.message);
    setAuthLoading(false);
  }

  // ── Sign out ─────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null); setProfile(null); setView("login");
    setEmail(""); setPassword(""); setFullName(""); setAuthErr("");
  }

  // ── Timer ────────────────────────────
  useEffect(() => {
    if (view === "exam" && !examDone && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timerRef.current);
    }
    if (timeLeft <= 0 && view === "exam" && !examDone) finishExam();
  }, [view, examDone, timeLeft]);

  // ── Start Exam ───────────────────────
  function startExam(examDef) {
    let qs;
    if (examDef) {
      qs = examDef.question_ids.map(id => QUESTIONS.find(q => q.id === id)).filter(Boolean);
      setActiveExamId(examDef.id);
      setTimeLeft(examDef.time_limit * 60);
    } else {
      qs = shuffle(QUESTIONS).slice(0, 22);
      setActiveExamId(null);
      setTimeLeft(35 * 60);
    }
    setExamQs(qs); setCurQ(0); setAns({}); setExamDone(false); setLastResult(null); setView("exam");
  }

  // ── Finish Exam ──────────────────────
  async function finishExam() {
    clearInterval(timerRef.current); setExamDone(true);
    let correct = 0;
    const bd = {}; CATS.forEach(c => bd[c] = { correct: 0, total: 0 });
    examQs.forEach((q, i) => { bd[q.cat].total++; if (ans[i] === q.ans) { correct++; bd[q.cat].correct++; } });

    const pct = Math.round((correct / examQs.length) * 100);
    const scaled = rawToScaled(correct, examQs.length);
    const tLimit = activeExamId ? (exams.find(e => e.id === activeExamId)?.time_limit || 35) * 60 : 35 * 60;
    const tUsed = tLimit - timeLeft;

    const result = {
      user_id: profile.id,
      exam_id: activeExamId,
      score: pct,
      scaled_score: scaled,
      correct,
      total: examQs.length,
      time_used: tUsed,
      breakdown: bd,
      answers: examQs.map((q, i) => ({ qId: q.id, userAns: ans[i] ?? null, correct: q.ans })),
    };

    const { data: inserted, error } = await supabase.from("results").insert(result).select().single();
    if (!error && inserted) {
      setLastResult(inserted);
      setResults(prev => [...prev, inserted]);
    } else {
      setLastResult(result);
    }
    setView("examResult");
  }

  // ── Admin: create exam ───────────────
  async function createExam() {
    if (!newExamTitle.trim()) return;
    const pool = QUESTIONS.filter(q => newExamCats[q.cat] && newExamDiffs[q.diff]);
    const picked = shuffle(pool).slice(0, Math.min(newExamCount, pool.length));
    const exam = {
      title: newExamTitle.trim(),
      question_ids: picked.map(q => q.id),
      time_limit: newExamTime,
      created_by: profile.id,
    };
    const { data, error } = await supabase.from("exams").insert(exam).select().single();
    if (!error && data) setExams(prev => [data, ...prev]);
    setNewExamTitle(""); setView("adminExams");
  }

  // ── Admin: delete exam ───────────────
  async function deleteExam(id) {
    if (!confirm("Delete this exam?")) return;
    await supabase.from("exams").delete().eq("id", id);
    setExams(prev => prev.filter(e => e.id !== id));
  }

  // ── Derived data ─────────────────────
  const isAdmin = profile?.role === "admin";
  const myResults = results.filter(r => r.user_id === profile?.id);
  const students = allProfiles.filter(u => u.role === "student");

  // ═══════════════════════════════════════════════════════════
  //  LOADING
  // ═══════════════════════════════════════════════════════════
  if (loading) return (
    <div style={{...T.page, display:"flex", alignItems:"center", justifyContent:"center"}}>
      <p style={{color:"#5a7a9e"}}>Loading...</p>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  AUTH SCREEN
  // ═══════════════════════════════════════════════════════════
  if (!session || !profile) {
    return <div style={T.page}>
      <div style={{...T.wrap, maxWidth:420, paddingTop:60}}>
        <div style={{textAlign:"center", marginBottom:32}}>
          <div style={{width:56,height:56,background:"linear-gradient(135deg,#f59e0b,#d97706)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:24,color:"#1a0a00",margin:"0 auto 16px"}}>π</div>
          <h1 style={{fontSize:26,fontWeight:800,color:"#f1f5f9",marginBottom:4}}>SAT Math Prep</h1>
          <p style={{color:"#5a7a9e",fontSize:14}}>{authMode==="login"?"Sign in to continue":"Create your student account"}</p>
        </div>
        <div style={T.card}>
          {authMode==="register" && (
            <input style={{...T.inp, marginBottom:12}} placeholder="Full name" value={fullName}
              onChange={e=>setFullName(e.target.value)} />
          )}
          <input style={{...T.inp, marginBottom:12}} placeholder="Email address" type="email" value={email}
            onChange={e=>setEmail(e.target.value)} />
          <input style={{...T.inp, marginBottom:4}} placeholder="Password" type="password" value={password}
            onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter" && (authMode==="login" ? handleSignIn() : handleSignUp())} />
          {authErr && <p style={{color:"#f87171",fontSize:13,marginTop:8}}>{authErr}</p>}

          <button style={{...T.btn,...T.pri,width:"100%",marginTop:16, opacity:authLoading?0.6:1}}
            onClick={authMode==="login" ? handleSignIn : handleSignUp}
            disabled={authLoading}>
            {authLoading ? "Please wait..." : authMode==="login" ? "Sign In" : "Create Account"}
          </button>

          <p style={{textAlign:"center",fontSize:13,color:"#5a7a9e",marginTop:16}}>
            {authMode==="login" ? <>New student? <span style={{color:"#f59e0b",cursor:"pointer",fontWeight:600}} onClick={()=>{setAuthMode("register");setAuthErr("");}}>Create account</span></>
             : <>Already registered? <span style={{color:"#f59e0b",cursor:"pointer",fontWeight:600}} onClick={()=>{setAuthMode("login");setAuthErr("");}}>Sign in</span></>}
          </p>
        </div>
      </div>
    </div>;
  }

  // ═══════════════════════════════════════════════════════════
  //  EXAM VIEW
  // ═══════════════════════════════════════════════════════════
  if (view === "exam" && !examDone) {
    const q = examQs[curQ]; const urgent = timeLeft < 120;
    return <div style={T.page}>
      <div style={{...T.wrap, maxWidth:700}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <span style={{fontSize:14,color:"#8ba4c4"}}><strong style={{color:"#f1f5f9"}}>{curQ+1}</strong> / {examQs.length}</span>
            <Pill color={urgent?"#ef4444":"#f59e0b"} style={{fontSize:13,padding:"5px 12px"}}>⏱ {fmtTime(timeLeft)}</Pill>
          </div>
          <span style={{fontSize:12,color:"#5a7a9e"}}>{Object.keys(ans).length} answered</span>
        </div>
        <div style={{height:4,background:"#1a2332",borderRadius:2,marginBottom:24}}>
          <div style={{height:"100%",width:`${((curQ+1)/examQs.length)*100}%`,background:"linear-gradient(90deg,#f59e0b,#fbbf24)",borderRadius:2,transition:"width 0.3s"}}/>
        </div>
        <div style={{...T.card,padding:28}}>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <Pill color="#f59e0b">{q.cat}</Pill>
            <Pill color={q.diff==="Easy"?"#22c55e":q.diff==="Medium"?"#eab308":"#ef4444"}>{q.diff}</Pill>
          </div>
          <h2 style={{fontSize:18,fontWeight:600,color:"#f1f5f9",lineHeight:1.6,marginBottom:6}}><MathText text={q.q} /></h2>
          {q.chart && <QuestionChart chart={q.chart} />}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:q.chart?12:16}}>
            {q.opts.map((o,i)=>{
              const sel=ans[curQ]===i;
              return <button key={i} onClick={()=>setAns({...ans,[curQ]:i})} style={{
                display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderRadius:12,
                border:sel?"2px solid #f59e0b":"1px solid #1a2744",background:sel?"#f59e0b12":"#0c1421",
                color:sel?"#fde68a":"#8ba4c4",cursor:"pointer",fontSize:15,fontFamily:"'Outfit',sans-serif",textAlign:"left",transition:"all 0.15s",
              }}>
                <span style={{width:28,height:28,borderRadius:8,background:sel?"#f59e0b":"#1a2332",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:sel?"#1a0a00":"#5a7a9e",flexShrink:0}}>{String.fromCharCode(65+i)}</span><MathText text={o} />
              </button>;
            })}
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:14,gap:10}}>
          <button style={{...T.btn,...T.sec,opacity:curQ>0?1:0.4}} onClick={()=>curQ>0&&setCurQ(curQ-1)} disabled={curQ===0}>← Prev</button>
          {curQ<examQs.length-1 ?
            <button style={{...T.btn,...T.pri}} onClick={()=>setCurQ(curQ+1)}>Next →</button> :
            <button style={{...T.btn,background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff"}} onClick={finishExam}>Submit ✓</button>}
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:5,marginTop:20,flexWrap:"wrap"}}>
          {examQs.map((_,i)=><button key={i} onClick={()=>setCurQ(i)} style={{
            width:26,height:26,borderRadius:7,border:"none",cursor:"pointer",
            background:i===curQ?"#f59e0b":ans[i]!==undefined?"#1e3050":"#1a2332",
            color:i===curQ?"#1a0a00":ans[i]!==undefined?"#8ba4c4":"#334155",
            fontSize:10,fontWeight:700,fontFamily:"'Outfit',sans-serif",
          }}>{i+1}</button>)}
        </div>
      </div>
    </div>;
  }

  // ═══════════════════════════════════════════════════════════
  //  EXAM RESULT
  // ═══════════════════════════════════════════════════════════
  if (view === "examResult" && lastResult) {
    const r = lastResult; const {g, c:gc} = gradeOf(r.score);
    return <div style={T.page}>
      <div style={{...T.wrap, maxWidth:700}}>
        <button style={{...T.btn,...T.sec,marginBottom:20}} onClick={()=>{loadData(profile);setView(isAdmin?"adminHome":"studentHome");}}>← Dashboard</button>
        <div style={{...T.card,textAlign:"center",padding:36,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:`linear-gradient(90deg,${gc},${gc}88)`}}/>
          <p style={{fontSize:13,color:"#5a7a9e",marginBottom:14}}>Exam Complete</p>
          <div style={{position:"relative",width:100,height:100,margin:"0 auto 14px"}}>
            <ProgressRing pct={r.score} size={100} stroke={9} color={gc}/>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:28,fontWeight:800,color:gc}}>{g}</span>
            </div>
          </div>
          <p style={{...T.big,color:"#f1f5f9"}}>{r.score}%</p>
          <p style={{fontSize:14,color:"#8ba4c4",marginTop:4}}>{r.correct}/{r.total} correct</p>
          <p style={{fontSize:20,fontWeight:700,color:"#fbbf24",marginTop:8}}>SAT Score: {r.scaled_score}</p>
          <p style={{fontSize:13,color:"#5a7a9e",marginTop:6}}>Time: {fmtTime(r.time_used)}</p>
        </div>
        <div style={T.card}>
          <p style={T.cardH}>Category Breakdown</p>
          {CATS.map(cat=>{const d=r.breakdown?.[cat];if(!d||!d.total)return null;const p=Math.round(d.correct/d.total*100);
            return <div key={cat} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <span style={{flex:"0 0 130px",fontSize:13,color:"#8ba4c4"}}>{cat}</span>
              <div style={{flex:1,height:8,background:"#1a2332",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${p}%`,background:scoreColor(p),borderRadius:4,transition:"width 0.5s"}}/>
              </div>
              <span style={{flex:"0 0 55px",fontSize:13,fontWeight:600,color:scoreColor(p),textAlign:"right"}}>{d.correct}/{d.total}</span>
            </div>;})}
        </div>
        <div style={T.card}>
          <p style={T.cardH}>Question Review</p>
          {(r.answers||[]).map((a,i)=>{const q=examQs[i]||QUESTIONS.find(x=>x.id===a.qId);if(!q)return null;
            const ok=a.userAns===a.correct;const skip=a.userAns===null;
            return <div key={i} style={{padding:"12px 0",borderBottom:i<(r.answers||[]).length-1?"1px solid #1a274422":"none"}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{width:24,height:24,borderRadius:6,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,background:skip?"#eab30818":ok?"#22c55e18":"#ef444418",color:skip?"#eab308":ok?"#22c55e":"#ef4444"}}>{skip?"–":ok?"✓":"✗"}</span>
                <div style={{flex:1}}>
                  <p style={{fontSize:14,color:"#e2e8f0",lineHeight:1.5}}><MathText text={q.q} /></p>
                  <div style={{fontSize:12,color:"#5a7a9e",marginTop:5,display:"flex",gap:12,flexWrap:"wrap"}}>
                    {!ok&&!skip&&<span>Yours: <span style={{color:"#f87171"}}><MathText text={q.opts[a.userAns]} /></span></span>}
                    <span>Answer: <span style={{color:"#4ade80"}}><MathText text={q.opts[a.correct]} /></span></span>
                  </div>
                </div>
              </div>
            </div>;})}
        </div>
        <div style={{display:"flex",gap:12}}>
          <button style={{...T.btn,...T.pri,flex:1}} onClick={()=>startExam(null)}>Practice Again</button>
          <button style={{...T.btn,...T.sec}} onClick={()=>{loadData(profile);setView(isAdmin?"adminHome":"studentHome");}}>Dashboard</button>
        </div>
      </div>
    </div>;
  }

  // ═══════════════════════════════════════════════════════════
  //  HEADER
  // ═══════════════════════════════════════════════════════════
  const Header = ({navItems, currentView}) => <>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,background:"linear-gradient(135deg,#f59e0b,#d97706)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:"#1a0a00"}}>π</div>
        <div><div style={{fontSize:20,fontWeight:700,color:"#f1f5f9"}}>SAT Math Prep</div>
          <div style={{fontSize:12,color:"#5a7a9e"}}>{profile?.name} · {isAdmin?"Admin":"Student"}</div></div>
      </div>
      <button style={{...T.btn,...T.sec,fontSize:12,padding:"7px 14px"}} onClick={handleSignOut}>Sign Out</button>
    </div>
    <div style={T.nav}>{navItems.map(n=><button key={n.v} style={T.navBtn(currentView===n.v)} onClick={()=>setView(n.v)}>{n.label}</button>)}</div>
  </>;

  // ═══════════════════════════════════════════════════════════
  //  STUDENT DASHBOARD
  // ═══════════════════════════════════════════════════════════
  if (!isAdmin && (view === "studentHome")) {
    const avg = myResults.length ? Math.round(myResults.reduce((s,r)=>s+r.score,0)/myResults.length) : 0;
    const best = myResults.length ? Math.max(...myResults.map(r=>r.score)) : 0;
    const latest = myResults.length ? myResults[myResults.length-1] : null;
    const avgScaled = myResults.length ? Math.round(myResults.reduce((s,r)=>s+r.scaled_score,0)/myResults.length) : 0;
    const imp = myResults.length>=2 ? myResults[myResults.length-1].score - myResults[0].score : 0;
    const catSt={}; CATS.forEach(c=>{let cr=0,t=0;myResults.forEach(r=>{if(r.breakdown?.[c]){cr+=r.breakdown[c].correct;t+=r.breakdown[c].total;}});catSt[c]=t?Math.round(cr/t*100):0;});

    return <div style={T.page}><div style={T.wrap}>
      <Header navItems={[{v:"studentHome",label:"Dashboard"}]} currentView={view}/>

      {exams.length>0 && <div style={T.card}>
        <p style={T.cardH}>Assigned Exams</p>
        {exams.map(ex=>{
          const taken=myResults.find(r=>r.exam_id===ex.id);
          return <div key={ex.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #1a274422",flexWrap:"wrap",gap:8}}>
            <div><p style={{fontSize:15,fontWeight:600,color:"#f1f5f9"}}>{ex.title}</p>
              <p style={{fontSize:12,color:"#5a7a9e"}}>{ex.question_ids?.length||0} questions · {ex.time_limit} min</p></div>
            {taken ? <Pill color="#22c55e">Score: {taken.score}% · SAT {taken.scaled_score}</Pill> :
              <button style={{...T.btn,...T.pri,padding:"8px 16px",fontSize:13}} onClick={()=>startExam(ex)}>Take Exam</button>}
          </div>;
        })}
      </div>}

      <div style={{...T.card,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div><p style={{fontSize:16,fontWeight:700,color:"#f1f5f9"}}>Practice Exam</p>
          <p style={{fontSize:13,color:"#5a7a9e"}}>22 random questions · 35 min · SAT-scored</p></div>
        <button style={{...T.btn,...T.pri}} onClick={()=>startExam(null)}>Start Practice →</button>
      </div>

      {myResults.length===0 ? <div style={{...T.card,textAlign:"center",padding:48}}>
        <p style={{fontSize:40,marginBottom:12}}>📐</p>
        <p style={{fontSize:18,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>No exams taken yet</p>
        <p style={{color:"#5a7a9e",fontSize:14}}>Complete a practice or assigned exam to see your progress.</p>
      </div> : <>
        <div style={{...T.grid,gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",marginBottom:0}}>
          {[{l:"Average",v:`${avg}%`,c:scoreColor(avg),s:`SAT ~${avgScaled}`},
            {l:"Best Score",v:`${best}%`,c:"#22c55e",s:gradeOf(best).g+" grade"},
            {l:"Latest SAT",v:latest?String(latest.scaled_score):"—",c:"#fbbf24",s:latest?`${latest.score}%`:"—"},
            {l:"Improvement",v:`${imp>=0?"+":""}${imp}%`,c:imp>=0?"#22c55e":"#ef4444",s:"first → latest"},
          ].map((s,i)=><div key={i} style={T.card}><p style={T.cardH}>{s.l}</p><p style={{...T.big,color:s.c}}>{s.v}</p><p style={T.sub}>{s.s}</p></div>)}
        </div>

        <div style={{...T.grid,gridTemplateColumns:"1fr 1fr"}}>
          <div style={T.card}>
            <p style={T.cardH}>Score Trend</p>
            <div style={{display:"flex",alignItems:"flex-end",gap:4,height:56}}>
              {myResults.slice(-14).map((r,i)=><div key={i} style={{flex:1,maxWidth:18,height:`${Math.max(8,r.score)}%`,background:"#f59e0b",borderRadius:"3px 3px 0 0",opacity:0.5+(i/14)*0.5}} title={`${r.score}%`}/>)}
            </div>
          </div>
          <div style={T.card}>
            <p style={T.cardH}>Category Accuracy</p>
            {CATS.map(c=><div key={c} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{flex:"0 0 105px",fontSize:12,color:"#8ba4c4"}}>{c}</span>
              <div style={{flex:1,height:6,background:"#1a2332",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${catSt[c]}%`,background:scoreColor(catSt[c]),borderRadius:3}}/>
              </div>
              <span style={{flex:"0 0 32px",fontSize:12,fontWeight:600,color:scoreColor(catSt[c]),textAlign:"right"}}>{catSt[c]}%</span>
            </div>)}
          </div>
        </div>

        <div style={T.card}>
          <p style={T.cardH}>Exam History</p>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:13}}>
              <thead><tr style={{borderBottom:"1px solid #1a2744"}}>{["#","Date","Score","SAT","Time","Grade"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",color:"#5a7a9e",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>)}</tr></thead>
              <tbody>{[...myResults].reverse().map((h,i)=>{const{g,c:gc}=gradeOf(h.score);
                return <tr key={h.id}><td style={{padding:10,color:"#5a7a9e"}}>{myResults.length-i}</td>
                  <td style={{padding:10,color:"#8ba4c4"}}>{fmtDate(h.created_at)}</td>
                  <td style={{padding:10,fontWeight:700,color:scoreColor(h.score)}}>{h.score}%</td>
                  <td style={{padding:10,color:"#fbbf24",fontWeight:600}}>{h.scaled_score}</td>
                  <td style={{padding:10,color:"#5a7a9e"}}>{fmtTime(h.time_used)}</td>
                  <td style={{padding:10}}><Pill color={gc}>{g}</Pill></td></tr>;})}</tbody>
            </table>
          </div>
        </div>
      </>}
    </div></div>;
  }

  // ═══════════════════════════════════════════════════════════
  //  ADMIN VIEWS
  // ═══════════════════════════════════════════════════════════
  const adminNav = [
    {v:"adminHome",label:"Overview"},{v:"adminStudents",label:"Students"},
    {v:"adminExams",label:"Exams"},{v:"adminCreateExam",label:"+ Create Exam"},
    {v:"adminAnalytics",label:"Analytics"}
  ];

  if (isAdmin) return <div style={T.page}><div style={T.wrap}>
    <Header navItems={adminNav} currentView={view}/>

    {/* ADMIN OVERVIEW */}
    {view==="adminHome" && <>
      <div style={{...T.grid,gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",marginBottom:0}}>
        {[{l:"Students",v:students.length,c:"#f59e0b"},
          {l:"Exams Created",v:exams.length,c:"#818cf8"},
          {l:"Total Attempts",v:results.length,c:"#22c55e"},
          {l:"Program Avg SAT",v:results.length?Math.round(results.reduce((s,r)=>s+r.scaled_score,0)/results.length):"—",c:"#fbbf24"},
        ].map((s,i)=><div key={i} style={T.card}><p style={T.cardH}>{s.l}</p><p style={{...T.big,color:s.c}}>{s.v}</p></div>)}
      </div>
      <div style={{...T.card,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div><p style={{fontSize:16,fontWeight:700,color:"#f1f5f9"}}>Take a Practice Exam</p>
          <p style={{fontSize:13,color:"#5a7a9e"}}>Preview the student experience</p></div>
        <button style={{...T.btn,...T.pri}} onClick={()=>startExam(null)}>Start Practice →</button>
      </div>
      <div style={T.card}>
        <p style={T.cardH}>Recent Activity</p>
        {results.length===0 ? <p style={{color:"#5a7a9e",fontSize:14}}>No exam attempts yet.</p> :
          [...results].reverse().slice(0,10).map(r=>{
            const s=allProfiles.find(u=>u.id===r.user_id);
            return <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1a274422"}}>
              <div><span style={{fontWeight:600,color:"#f1f5f9"}}>{s?.name||"Unknown"}</span>
                <span style={{color:"#5a7a9e",fontSize:13,marginLeft:8}}>{fmtDate(r.created_at)}</span></div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontWeight:700,color:scoreColor(r.score)}}>{r.score}%</span>
                <Pill color="#fbbf24">SAT {r.scaled_score}</Pill>
              </div>
            </div>;
          })}
      </div>
    </>}

    {/* ADMIN STUDENTS */}
    {view==="adminStudents" && <div style={T.card}>
      <p style={T.cardH}>All Students ({students.length})</p>
      {students.length===0 ? <p style={{color:"#5a7a9e",fontSize:14}}>No students registered yet. Share your site link for students to sign up.</p> :
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",fontSize:13}}>
            <thead><tr style={{borderBottom:"1px solid #1a2744"}}>{["Name","Exams","Avg Score","Avg SAT","Best SAT","Joined"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",color:"#5a7a9e",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>)}</tr></thead>
            <tbody>{students.map(s=>{
              const sr=results.filter(r=>r.user_id===s.id);
              const avg=sr.length?Math.round(sr.reduce((a,r)=>a+r.score,0)/sr.length):0;
              const avgSAT=sr.length?Math.round(sr.reduce((a,r)=>a+r.scaled_score,0)/sr.length):0;
              const bestSAT=sr.length?Math.max(...sr.map(r=>r.scaled_score)):0;
              return <tr key={s.id} style={{cursor:"pointer",borderBottom:"1px solid #1a274422"}} onClick={()=>{setSelectedStudent(s);setView("adminAnalytics");}}>
                <td style={{padding:10,fontWeight:600,color:"#f1f5f9"}}>{s.name}</td>
                <td style={{padding:10,color:"#8ba4c4"}}>{sr.length}</td>
                <td style={{padding:10,fontWeight:600,color:sr.length?scoreColor(avg):"#5a7a9e"}}>{sr.length?`${avg}%`:"—"}</td>
                <td style={{padding:10,color:"#fbbf24",fontWeight:600}}>{sr.length?avgSAT:"—"}</td>
                <td style={{padding:10,color:"#22c55e",fontWeight:600}}>{sr.length?bestSAT:"—"}</td>
                <td style={{padding:10,color:"#5a7a9e"}}>{fmtDate(s.created_at)}</td>
              </tr>;})}</tbody>
          </table>
        </div>}
    </div>}

    {/* ADMIN EXAMS */}
    {view==="adminExams" && <div style={T.card}>
      <p style={T.cardH}>Assigned Exams</p>
      {exams.length===0 ? <p style={{color:"#5a7a9e",fontSize:14}}>No exams created. Use "+ Create Exam" to make one.</p> :
        exams.map(ex=>{
          const attempts=results.filter(r=>r.exam_id===ex.id);
          const avgS=attempts.length?Math.round(attempts.reduce((a,r)=>a+r.scaled_score,0)/attempts.length):0;
          return <div key={ex.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:"1px solid #1a274422",flexWrap:"wrap",gap:8}}>
            <div><p style={{fontSize:15,fontWeight:600,color:"#f1f5f9"}}>{ex.title}</p>
              <p style={{fontSize:12,color:"#5a7a9e"}}>{ex.question_ids?.length||0} questions · {ex.time_limit} min · {fmtDate(ex.created_at)}</p></div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Pill color="#818cf8">{attempts.length} attempts</Pill>
              {attempts.length>0 && <Pill color="#fbbf24">Avg SAT {avgS}</Pill>}
              {ex.preset ? <Pill color="#22c55e">Built-in</Pill> : <button style={{...T.btn,...T.dan,padding:"6px 12px",fontSize:12}} onClick={()=>deleteExam(ex.id)}>Delete</button>}
            </div>
          </div>;
        })}
    </div>}

    {/* ADMIN CREATE EXAM */}
    {view==="adminCreateExam" && <div style={T.card}>
      <p style={T.cardH}>Create New Exam</p>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:13,color:"#8ba4c4",display:"block",marginBottom:6}}>Exam Title</label>
        <input style={T.inp} value={newExamTitle} onChange={e=>setNewExamTitle(e.target.value)} placeholder="e.g. Midterm Practice #1"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div><label style={{fontSize:13,color:"#8ba4c4",display:"block",marginBottom:6}}>Time Limit (minutes)</label>
          <input type="number" style={T.inp} value={newExamTime} onChange={e=>setNewExamTime(Number(e.target.value))} min={5} max={120}/></div>
        <div><label style={{fontSize:13,color:"#8ba4c4",display:"block",marginBottom:6}}>Number of Questions</label>
          <input type="number" style={T.inp} value={newExamCount} onChange={e=>setNewExamCount(Number(e.target.value))} min={5} max={44}/></div>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:13,color:"#8ba4c4",display:"block",marginBottom:8}}>Categories</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {CATS.map(c=><button key={c} onClick={()=>setNewExamCats({...newExamCats,[c]:!newExamCats[c]})} style={{
            padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Outfit',sans-serif",
            background:newExamCats[c]?"#f59e0b":"#162033",color:newExamCats[c]?"#1a0a00":"#5a7a9e",
          }}>{c}</button>)}
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <label style={{fontSize:13,color:"#8ba4c4",display:"block",marginBottom:8}}>Difficulty</label>
        <div style={{display:"flex",gap:8}}>
          {DIFFS.map(d=><button key={d} onClick={()=>setNewExamDiffs({...newExamDiffs,[d]:!newExamDiffs[d]})} style={{
            padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Outfit',sans-serif",
            background:newExamDiffs[d]?d==="Easy"?"#22c55e":d==="Medium"?"#eab308":"#ef4444":"#162033",
            color:newExamDiffs[d]?"#000":"#5a7a9e",
          }}>{d}</button>)}
        </div>
      </div>
      <p style={{fontSize:13,color:"#5a7a9e",marginBottom:14}}>
        Available: {QUESTIONS.filter(q=>newExamCats[q.cat]&&newExamDiffs[q.diff]).length} questions matching
      </p>
      <button style={{...T.btn,...T.pri,opacity:newExamTitle.trim()?1:0.5}} onClick={createExam} disabled={!newExamTitle.trim()}>
        Create & Assign to All Students →
      </button>
    </div>}

    {/* ADMIN ANALYTICS */}
    {view==="adminAnalytics" && <>
      <div style={T.card}>
        <p style={T.cardH}>Student Analytics</p>
        <div style={{display:"flex",gap:8,marginBottom:4,flexWrap:"wrap"}}>
          <button style={T.navBtn(!selectedStudent)} onClick={()=>setSelectedStudent(null)}>All Students</button>
          {students.map(s=><button key={s.id} style={T.navBtn(selectedStudent?.id===s.id)} onClick={()=>setSelectedStudent(s)}>{s.name}</button>)}
        </div>
      </div>
      {(()=>{
        const sr=selectedStudent?results.filter(r=>r.user_id===selectedStudent.id):results;
        if(!sr.length) return <div style={T.card}><p style={{color:"#5a7a9e",textAlign:"center",padding:20}}>No data{selectedStudent?` for ${selectedStudent.name}`:""}</p></div>;

        const avg=Math.round(sr.reduce((a,r)=>a+r.score,0)/sr.length);
        const avgSAT=Math.round(sr.reduce((a,r)=>a+r.scaled_score,0)/sr.length);
        const bestSAT=Math.max(...sr.map(r=>r.scaled_score));
        const avgTime=Math.round(sr.reduce((a,r)=>a+r.time_used,0)/sr.length);

        const catDt={};CATS.forEach(c=>{let cr=0,t=0;sr.forEach(r=>{if(r.breakdown?.[c]){cr+=r.breakdown[c].correct;t+=r.breakdown[c].total;}});catDt[c]={pct:t?Math.round(cr/t*100):0,total:t};});
        const weakest=Object.entries(catDt).filter(([,v])=>v.total>0).sort((a,b)=>a[1].pct-b[1].pct)[0];
        const strongest=Object.entries(catDt).filter(([,v])=>v.total>0).sort((a,b)=>b[1].pct-a[1].pct)[0];

        const diffDt={};DIFFS.forEach(d=>{let cr=0,t=0;sr.forEach(r=>{(r.answers||[]).forEach(a=>{const q=QUESTIONS.find(x=>x.id===a.qId);if(q?.diff===d){t++;if(a.userAns===a.correct)cr++;}});});diffDt[d]=t?Math.round(cr/t*100):0;});

        return <>
          <div style={{...T.grid,gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",marginBottom:0}}>
            {[{l:"Avg Score",v:`${avg}%`,c:scoreColor(avg)},{l:"Avg SAT",v:String(avgSAT),c:"#fbbf24"},
              {l:"Best SAT",v:String(bestSAT),c:"#22c55e"},{l:"Avg Time",v:fmtTime(avgTime),c:"#818cf8"},
              {l:"Weakest",v:weakest?weakest[0]:"—",c:"#ef4444"},{l:"Strongest",v:strongest?strongest[0]:"—",c:"#22c55e"},
            ].map((s,i)=><div key={i} style={T.card}><p style={T.cardH}>{s.l}</p><p style={{fontSize:22,fontWeight:800,color:s.c,letterSpacing:"-0.02em"}}>{s.v}</p></div>)}
          </div>
          <div style={{...T.grid,gridTemplateColumns:"1fr 1fr"}}>
            <div style={T.card}>
              <p style={T.cardH}>Category Performance</p>
              {CATS.map(c=><div key={c} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{flex:"0 0 110px",fontSize:12,color:"#8ba4c4"}}>{c}</span>
                <div style={{flex:1,height:8,background:"#1a2332",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${catDt[c].pct}%`,background:scoreColor(catDt[c].pct),borderRadius:4}}/></div>
                <span style={{flex:"0 0 35px",fontSize:12,fontWeight:700,color:scoreColor(catDt[c].pct),textAlign:"right"}}>{catDt[c].pct}%</span>
              </div>)}
            </div>
            <div style={T.card}>
              <p style={T.cardH}>Difficulty Performance</p>
              {DIFFS.map(d=><div key={d} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{flex:"0 0 70px",fontSize:12,color:"#8ba4c4"}}>{d}</span>
                <div style={{flex:1,height:8,background:"#1a2332",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${diffDt[d]}%`,background:scoreColor(diffDt[d]),borderRadius:4}}/></div>
                <span style={{flex:"0 0 35px",fontSize:12,fontWeight:700,color:scoreColor(diffDt[d]),textAlign:"right"}}>{diffDt[d]}%</span>
              </div>)}
              <div style={{marginTop:16,padding:14,background:"#0c1421",borderRadius:10}}>
                <p style={{fontSize:13,color:"#8ba4c4",lineHeight:1.6}}>
                  {diffDt.Hard<50?"⚠️ Hard questions need focus. Prioritize Advanced Math and multi-step word problems.":
                   diffDt.Medium<60?"📊 Medium difficulty needs work. Review core algebra and geometry.":
                   "✅ Strong across all difficulty levels. Ready for more challenging content!"}
                </p>
              </div>
            </div>
          </div>
          <div style={T.card}>
            <p style={T.cardH}>Score Progression</p>
            <div style={{display:"flex",alignItems:"flex-end",gap:3,height:80}}>
              {sr.slice(-20).map((r,i)=><div key={i} style={{flex:1,maxWidth:24,height:`${Math.max(8,r.score)}%`,background:"linear-gradient(180deg,#f59e0b,#d97706)",borderRadius:"3px 3px 0 0",opacity:0.4+(i/20)*0.6}} title={`${r.score}% — SAT ${r.scaled_score}`}/>)}
            </div>
          </div>
          <div style={T.card}>
            <p style={T.cardH}>All Results</p>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:13}}>
                <thead><tr style={{borderBottom:"1px solid #1a2744"}}>{[...(selectedStudent?[]:["Student"]),"Date","Score","SAT","Correct","Time"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",color:"#5a7a9e",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>)}</tr></thead>
                <tbody>{[...sr].reverse().map(r=>{const s=allProfiles.find(u=>u.id===r.user_id);
                  return <tr key={r.id} style={{borderBottom:"1px solid #1a274422"}}>
                    {!selectedStudent&&<td style={{padding:10,fontWeight:600,color:"#f1f5f9"}}>{s?.name||"?"}</td>}
                    <td style={{padding:10,color:"#8ba4c4"}}>{fmtDate(r.created_at)}</td>
                    <td style={{padding:10,fontWeight:700,color:scoreColor(r.score)}}>{r.score}%</td>
                    <td style={{padding:10,color:"#fbbf24",fontWeight:600}}>{r.scaled_score}</td>
                    <td style={{padding:10,color:"#8ba4c4"}}>{r.correct}/{r.total}</td>
                    <td style={{padding:10,color:"#5a7a9e"}}>{fmtTime(r.time_used)}</td>
                  </tr>;})}</tbody>
              </table>
            </div>
          </div>
        </>;
      })()}
    </>}

  </div></div>;

  return null;
}
