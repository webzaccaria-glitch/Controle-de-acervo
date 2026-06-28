import { useState, useEffect, useRef } from 'react'

const GOOGLE_CLIENT_ID = '239442392621-adsev5o9nhsd7u0g652s2tagirlvlddb.apps.googleusercontent.com'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events'
const FOLDER_NAME = 'Acervo de Festas'
const SESSION_KEY = 'acervo_session_v2'
const WEBHOOK_ACESSO = 'https://hook.us2.make.com/ki12w8ga6dyfuexrbyby6a7dd7ue888d'

// TEST - verifying commit API works
export default function App() { return <div>API TEST OK</div> }
