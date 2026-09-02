"use client";
import {KeyboardEvent,useEffect,useRef,useState} from "react";

export type SelectOption={value:string;label:string};

export default function CustomSelect({value,options,onChange,label}:{value:string;options:SelectOption[];onChange:(value:string)=>void;label:string}){
  const[open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const selected=options.find(option=>option.value===value)??options[0];
  useEffect(()=>{function close(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false)}document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close)},[]);
  function keys(event:KeyboardEvent<HTMLButtonElement>){if(event.key==="Escape"){setOpen(false);return}if(event.key!=="ArrowDown"&&event.key!=="ArrowUp"&&event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();if(!open){setOpen(true);return}if(event.key==="Enter"||event.key===" ")return;const index=Math.max(0,options.findIndex(option=>option.value===value));const next=event.key==="ArrowDown"?Math.min(options.length-1,index+1):Math.max(0,index-1);onChange(options[next].value)}
  return <div className={`customSelect${open?" open":""}`} ref={root}>
    <button type="button" className="customSelectTrigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(value=>!value)} onKeyDown={keys}><span>{selected?.label}</span><i/></button>
    {open&&<div className="customSelectMenu" role="listbox" aria-label={label}>{options.map(option=><button type="button" role="option" aria-selected={option.value===value} className={option.value===value?"selected":""} key={option.value} onClick={()=>{onChange(option.value);setOpen(false)}}><span>{option.label}</span><i/></button>)}</div>}
  </div>
}
