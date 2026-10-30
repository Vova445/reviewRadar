"use client";
import {useEffect,useState} from "react";

export type Language="uk"|"en";
const eventName="reviewradar:language";

export function useLanguage(){const[language,setLanguageState]=useState<Language>("uk");useEffect(()=>{const timer=window.setTimeout(()=>{const saved=localStorage.getItem("rr-language");if(saved==="uk"||saved==="en")setLanguageState(saved)},0);const sync=(event:Event)=>setLanguageState((event as CustomEvent<Language>).detail);window.addEventListener(eventName,sync);return()=>{window.clearTimeout(timer);window.removeEventListener(eventName,sync)}},[]);function setLanguage(next:Language){localStorage.setItem("rr-language",next);document.cookie=`rr_language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;document.documentElement.lang=next;setLanguageState(next);window.dispatchEvent(new CustomEvent(eventName,{detail:next}))}return{language,setLanguage}}

export function LanguageToggle({dark=false}:{dark?:boolean}){const{language,setLanguage}=useLanguage();return <div className={`languageToggle ${dark?"dark":""}`} role="group" aria-label="Language"><button type="button" className={language==="uk"?"active":""} onClick={()=>setLanguage("uk")} aria-label="Українська" aria-pressed={language==="uk"}>UA</button><button type="button" className={language==="en"?"active":""} onClick={()=>setLanguage("en")} aria-label="English" aria-pressed={language==="en"}>EN</button></div>}
