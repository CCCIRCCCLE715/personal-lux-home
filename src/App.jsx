import React, { useState, useEffect, useRef } from 'react';
import PaperPortrait from './PaperPortrait.jsx';
import SecondaryIcons from './SecondaryIcons.jsx';

const reactions=[{id:'like',label:'点赞',particle:'♥'},{id:'save',label:'收藏',particle:'★'},{id:'share',label:'转发',particle:'↗'}];
const videoCategories=['AI 设计','Vibe Coding','AI 赚钱','其他视频'];
const categoryIds=['ai-design','vibe-coding','ai-income','more-videos'];
const profileUrl='https://www.xiaohongshu.com/user/profile/5b85033f6e68470001debc86';
const featuredVideos=[
  {id:'ai-design',category:'AI 设计',title:'MiniMax H3：视频模型更新',cover:'/images/minimax-cover.png',rotation:'-8deg'},
  {id:'vibe-coding',category:'Vibe Coding',title:'0 代码做出高端网站滚动效果',cover:'/images/parallax-cover.png',rotation:'5deg'},
  {id:'ai-income',category:'AI 赚钱',title:'全网 30 万粉：如何从零做 AI 博主？',cover:'/images/ai-blogger-cover.png',rotation:'-4deg'},
  {id:'more-videos',category:'其他视频',title:'千问 9 大玩法：视频模型更新',cover:'/images/wan-play-cover.png',rotation:'9deg'},
];
function ReactionIcon({id}){
 if(id==='like')return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 5.8a5 5 0 0 0-7.1 0L12 7l-1.2-1.2a5 5 0 0 0-7.1 7.1L12 21l8.3-8.1a5 5 0 0 0 0-7.1Z"/></svg>;
 if(id==='save')return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 6 6.6 1-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.7 6.6-1Z"/></svg>;
 return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 4h7v7M20 4l-9 9M20 15v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4"/></svg>;
}
async function copyHomepageLink(){
 const link=window.location.origin+window.location.pathname;
 try{await navigator.clipboard.writeText(link);return true;}catch{
   const field=document.createElement('textarea');field.value=link;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
   let copied=false;try{copied=document.execCommand('copy');}catch{}finally{field.remove();}
   return copied;
 }
}
function ReactionButton({item}){
 const [selected,setSelected]=useState(false),[hovered,setHovered]=useState(false),[burst,setBurst]=useState(0),[message,setMessage]=useState('');
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),2600);return()=>clearTimeout(timer);},[message,burst]);
 const activate=()=>{setHovered(true);setBurst(n=>n+1);};
 return <button className={`reaction reaction-${item.id}${hovered||selected?' is-active':''}`}
   aria-label={item.id==='share'?'转发，复制首页链接':item.label} aria-pressed={selected}
   onPointerEnter={activate} onPointerLeave={()=>setHovered(false)}
   onFocus={activate} onBlur={()=>setHovered(false)}
   onClick={async()=>{
     setBurst(n=>n+1);
     if(item.id==='share'){
       const copied=await copyHomepageLink();setSelected(copied);setMessage(copied?'链接已复制':'复制失败，请复制地址栏链接');
     }else setSelected(v=>!v);
   }}>
   <span className="reaction-circle"><ReactionIcon id={item.id}/></span>
   <span className="reaction-label" aria-hidden="true">{item.label}</span>
   {burst>0&&<span key={burst} className="reaction-burst" aria-hidden="true">{[0,1,2].map(i=><span key={i}>{item.particle}</span>)}</span>}
   {message&&<span className="reaction-feedback" role="status">{message}</span>}
 </button>;
}
export default function App(){
  const [progress,setProgress]=useState(0); const stage=useRef(null);
  useEffect(()=>{let frame;const reduced=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const el=stage.current;if(!el)return;const distance=el.offsetHeight-innerHeight;setProgress(reduced.matches?1:Math.max(0,Math.min(1,-el.getBoundingClientRect().top/Math.max(distance,1))));});};addEventListener('scroll',update,{passive:true});addEventListener('resize',update);reduced.addEventListener('change',update);update();return()=>{cancelAnimationFrame(frame);removeEventListener('scroll',update);removeEventListener('resize',update);reduced.removeEventListener('change',update);};},[]);
  const [flipped,setFlipped]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  // The upper half of the portrait tears open by itself ~0.5s after load,
  // revealing the models inside the head without any scrolling.
  const [autoPeel,setAutoPeel]=useState(0);
  useEffect(()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){setAutoPeel(1);return;}
    let raf;const t0=performance.now();
    const tick=now=>{const raw=Math.max(0,Math.min(1,(now-t0-500)/900));setAutoPeel(raw*raw*(3-2*raw));if(raw<1)raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[]);
  const upperProgress=autoPeel;
  // The lower half starts peeling on the first scroll; the tear, the exit
  // flight and the model scatter all complete right as page 2 scrolls in.
  const lowerProgress=progress;
  // The models start spreading out the moment scrolling begins.
  const scatterProgress=Math.max(0,Math.min(1,lowerProgress/.75));
  const heroExit=Math.max(0,1-lowerProgress*4);
  // Page 2 fades in over the hero while the scattered models are still
  // settling, so there is no long blank stretch between the two pages.
  const secondShow=Math.max(0,Math.min(1,(lowerProgress-.4)/.4));
  const jumpToCategory=(event,id)=>{
    event.preventDefault();setMenuOpen(false);
    history.replaceState(null,'',`#${id}`);
    document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  };
  const menuRef=useRef(null);
  useEffect(()=>{
    if(!menuOpen)return;
    const onKey=e=>{if(e.key==='Escape')setMenuOpen(false);};
    const onOutside=e=>{if(!menuRef.current?.contains(e.target))setMenuOpen(false);};
    addEventListener('keydown',onKey);addEventListener('pointerdown',onOutside);
    return()=>{removeEventListener('keydown',onKey);removeEventListener('pointerdown',onOutside);};
  },[menuOpen]);
  return <main className="homepage">
    <div className="scroll-stage" ref={stage}><div className="sticky-stage"><header className="header"><a className="brand" href="#home" aria-label="黄白首页">黄白<span>HUANG BAI</span></a>
      <div className="menu-wrap" ref={menuRef}><button className={`menu-toggle${menuOpen?' is-open':''}`} aria-label={menuOpen?'关闭导航菜单':'打开导航菜单'} aria-expanded={menuOpen} aria-controls="video-navigation" onClick={()=>setMenuOpen(v=>!v)}><span/><span/><span/></button>
      {menuOpen&&<nav className="menu-panel" id="video-navigation" aria-label="视频分类导航"><span className="menu-eyebrow">视频分类 / VIDEOS</span>
        {videoCategories.map((name,index)=><a key={name} className="menu-item" href={`#${categoryIds[index]}`} onClick={event=>jumpToCategory(event,categoryIds[index])}><span>{String(index+1).padStart(2,'0')}</span><strong>{name}</strong><span>→</span></a>)}
        <a className="menu-follow" href={profileUrl} target="_blank" rel="noopener noreferrer" onClick={()=>setMenuOpen(false)}><span>＋</span> 关注我 <span>↗</span></a>
      </nav>}</div></header>
    <section className="hero" id="home" aria-label="黄白的个人创意空间" style={{'--hero-exit':heroExit}}>
      <h1 className="hero-title" aria-label="黄白 Huang Bai"><span className="title-word first">HUANG</span><span className="title-word last">BAI<span className="title-dot">.</span></span></h1>
      <div className="collage"><PaperPortrait progress={upperProgress} lowerProgress={lowerProgress} scatter={scatterProgress}/></div>
      <div className="hello-label"><span>HELLO, I'M</span><strong>黄白<span>✳</span></strong><p>把新想法，变成看得见的东西。</p></div>
      <div className="cover-area"><span className="cover-caption">最近在做什么？<span>↙</span></span><button className={flipped?'cover-book flipped':'cover-book'} onClick={()=>setFlipped(!flipped)} aria-label="翻看视差滚动视频封面" aria-pressed={flipped}><span className="book-back"><span>让网页<br/>变成一个<br/><b>新世界。</b></span><small>视差滚动 / 网站设计</small></span><span className="book-front"><img src="/images/parallax-cover.png" alt="视差滚动视频封面，黄白身穿宇航服使用电脑"/><span className="page-curl"/></span></button><span className="cover-foot">小红书 · 创作笔记 <span>↗</span></span></div>
      <aside className="reaction-rail" aria-label="互动按钮">{reactions.map(item=><ReactionButton key={item.id} item={item}/>)}</aside>
      <span className="edition">PERSONAL SPACE — 2026</span>
      <div className="scroll-hint"><span>{upperProgress<.9?"向下滚动，打开脑洞":"继续向下，遇见黄白"}</span><span>↓</span></div>
    </section></div></div>
    <section className="profile-scene" id="about" aria-label="关于黄白" style={{opacity:secondShow,pointerEvents:secondShow>.6?'auto':'none'}}>
      <div className="profile-scene-head"><span className="profile-eyebrow">ABOUT / 黄白</span><div className="profile-identity"><div><strong>黄白</strong><span>小红书 ID · Hss1128_</span></div><a className="profile-follow" href={profileUrl} target="_blank" rel="noopener noreferrer">＋ 关注 <span>↗</span></a></div></div>
      <div className="profile-intro"><span>01 / WHO I AM</span><h2>26 岁设计师。<br/>好奇心，一直在线。</h2><p>北京理工大学 · 前阿里、腾讯设计师<br/>全网 35W 订阅 AI 博主 · LibTV 签约导演<br/>分享好用的 AI，把想法做成看得见的东西。</p>
        <div className="profile-stats"><div><strong>14.9<span>万</span></strong><span>粉丝</span></div><div><strong>149.4<span>万</span></strong><span>获赞与收藏</span></div></div>
      </div>
      <div className="profile-video-head"><span>SELECTED VIDEOS</span><strong>一些最近的脑洞 <span>↗</span></strong></div>
      <div className="profile-cover-wall">{featuredVideos.map((video,index)=><a key={video.id} id={video.id} className="profile-cover-card" href={profileUrl} target="_blank" rel="noopener noreferrer" style={{'--card-rotate':video.rotation,'--card-index':index}}><span className="profile-cover-image"><img src={video.cover} alt={`${video.title}视频封面`}/><span className="profile-cover-arrow">↗</span></span><span className="profile-cover-meta">{video.category}<span>{String(index+1).padStart(2,'0')} / 04</span></span><strong>{video.title}</strong></a>)}</div>
      <SecondaryIcons active={lowerProgress>.5}/>
    </section>
  </main>
}
