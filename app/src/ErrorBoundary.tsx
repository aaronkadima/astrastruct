import React from 'react';

type State={error:Error|null};
export class ErrorBoundary extends React.Component<React.PropsWithChildren,State>{
  state:State={error:null};
  static getDerivedStateFromError(error:Error){return{error}}
  componentDidCatch(error:Error,info:React.ErrorInfo){console.error('AstraStruct React crash',error,info)}
  render(){if(this.state.error)return <main style={{minHeight:'100dvh',background:'#0b0f16',color:'#eef4ff',padding:'32px',fontFamily:'system-ui,sans-serif'}}><div style={{maxWidth:760,margin:'0 auto',border:'1px solid #743f48',borderRadius:12,padding:20,background:'#17131a'}}><h1 style={{marginTop:0,fontSize:22}}>AstraStruct não conseguiu iniciar</h1><p style={{color:'#b7c5d9'}}>A interface encontrou um erro inesperado. Recarregue a página. Se persistir, esta tela substitui a antiga página branca e permite diagnosticar a falha.</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:12,background:'#0b0f16',borderRadius:8,color:'#ffbec6'}}>{this.state.error.message}</pre></div></main>;return this.props.children}
}
