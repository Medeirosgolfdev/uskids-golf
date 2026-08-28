/*  ATENCAO — ESTE FICHEIRO NAO E USADO. Ver a nota no topo de App.jsx.
 *  A aplicacao que vai para o ar e o index.html na raiz do repositorio.
 * -------------------------------------------------------------------------- */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null, React.createElement(App))
)
