const WEBHOOK_URL = 'https://hook.eu2.make.com/SEU_WEBHOOK_AQUI'

export async function verificarAcesso(email) {
  try {
    const response = await fetch(`${WEBHOOK_URL}?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) return false

    const data = await response.json()

    return data.status === 'ativo'
  } catch (error) {
    console.error('Erro ao verificar acesso:', error)
    return false
  }
}
