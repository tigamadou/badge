import React, { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { api } from "../api"

/**
 * VerifyPage
 * - vérifie que l'utilisateur est admin via /api/current_user/
 * - propose scan caméra (start/stop), input manuel et upload image
 * - appelle POST /api/verify/ { ticket_uuid, mark_used } et affiche résultat
 */
export default function VerifyPage() {
  const [isAdmin, setIsAdmin] = useState(null) // null = checking
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState(null) // { valid, participant?, already_used?, reason? }
  const [error, setError] = useState(null)
  const [manualInput, setManualInput] = useState("")
  const [markUsed, setMarkUsed] = useState(true) // option to mark used on verify
  const html5QrcodeRef = useRef(null)
  const scannerId = "qr-scanner"
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      try {
        // use api helper (it returns data)
        const data = await api.currentUser()
        const payload = data?.data ?? data
        setIsAdmin(Boolean(payload?.is_staff))
      } catch (err) {
        console.warn("current_user failed", err)
        setIsAdmin(false)
      }
    })()

    return () => {
      mountedRef.current = false
      // cleanup scanner if running
      ;(async () => {
        try {
          if (html5QrcodeRef.current) {
            await html5QrcodeRef.current.stop().catch(() => {})
            html5QrcodeRef.current.clear().catch(() => {})
            html5QrcodeRef.current = null
          }
        } catch (e) {
          // ignore
        }
      })()
    }
  }, [])

  // Start camera scanner
  async function startScanner() {
    setError(null)
    setLastResult(null)
    try {
      if (html5QrcodeRef.current) {
        await html5QrcodeRef.current.stop().catch(() => {})
        html5QrcodeRef.current.clear().catch(() => {})
        html5QrcodeRef.current = null
      }

      html5QrcodeRef.current = new Html5Qrcode(scannerId, { verbose: false })

      // Get the scanner element dimensions
      const scannerElement = document.getElementById(scannerId)
      const scannerWidth = scannerElement.offsetWidth
      const scannerHeight = scannerElement.offsetHeight

      // Use full size of the scanner element
      const config = { 
        fps: 10, 
        qrbox: { width: scannerWidth, height: scannerHeight } 
      }

      await html5QrcodeRef.current.start(

        config,
        (decodedText /*, decodedResult */) => {
          // on successful scan
          // stop scanner to avoid duplicate scans, then verify
          ;(async () => {
            try {
              await stopScanner()
            } catch (e) {
              // ignore
            } finally {
              handleVerify(decodedText)
            }
          })()
        },
        (errorMessage) => {
          // ignore occasional scan errors
        }
      )

      if (mountedRef.current) setScanning(true)
    } catch (err) {
      console.error("Failed to start scanner", err)
      if (mountedRef.current) {
        setError(
          "Impossible d'accéder à la caméra. Vérifie les permissions et le navigateur."
        )
        setScanning(false)
      }
    }
  }

  // Stop camera scanner
  async function stopScanner() {
    setError(null)
    try {
      if (html5QrcodeRef.current) {
        await html5QrcodeRef.current.stop()
        await html5QrcodeRef.current.clear()
        html5QrcodeRef.current = null
      }
    } catch (err) {
      console.warn("Erreur arrêt scanner", err)
    } finally {
      if (mountedRef.current) setScanning(false)
    }
  }

  // Normalize payload: extract ticket UUID from payload like "ticket:UUID" or ?ticket=URL
  function extractTicket(payload) {
    if (!payload) return null
    try {
      if (typeof payload === "string" && payload.startsWith("ticket:")) {
        return payload.split("ticket:")[1]
      }
      // try url param
      try {
        const url = new URL(payload)
        if (url.searchParams.has("ticket"))
          return url.searchParams.get("ticket")
        // maybe the payload is the full verification url containing uuid in path
        const maybe = url.pathname.split("/").pop()
        if (maybe && maybe.length > 8) return maybe
      } catch (e) {
        // not a URL, use payload as-is
      }
      return payload
    } catch (e) {
      return null
    }
  }

  // Verify helper using api.verifyTicket
  async function handleVerify(payload) {
    setError(null)
    setLastResult(null)

    const ticket = extractTicket(payload)
    if (!ticket) {
      setError("QR scanné invalide (pas de ticket).")
      return
    }

    // If markUsed is requested but user not admin, block client-side (server will also enforce)
    if (markUsed && !isAdmin) {
      setError("Seul un administrateur peut marquer un billet comme utilisé.")
      return
    }

    try {
      // api.verifyTicket returns { valid: bool, participant: {...} } or throws 404
      const res = await api.verifyTicket({
        ticket_uuid: ticket,
        mark_used: Boolean(markUsed)
      })
      const payload = res?.data ?? res

      // Normaliser la réponse
      if (payload === null || payload === undefined) {
        setLastResult({ valid: false, reason: "Empty response" })
        return
      }

      // handle not found sent as 404 (apiFetch throws) — but just in case:
      if (payload.valid === false && payload.already_used) {
        setLastResult({
          valid: false,
          already_used: true,
          participant: payload.participant ?? null
        })
        return
      }

      if (payload.valid === true) {
        setLastResult({ valid: true, participant: payload.participant ?? null })
        return
      }

      // fallback
      setLastResult({
        valid: Boolean(payload.valid),
        participant: payload.participant ?? null
      })
    } catch (err) {
      // apiFetch throws on non-2xx — handle 404 specially
      if (err && err.status === 404) {
        setLastResult({ valid: false, reason: "Not found" })
        return
      }
      console.error("verify error:", err)
      setError(
        err?.data?.detail || err?.message || "Erreur lors de la vérification."
      )
    }
  }

  // Upload image fallback (reads QR from image)
  async function handleImageUpload(e) {
    setError(null)
    setLastResult(null)
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await Html5Qrcode.scanFileV2(file, /* showImage= */ false)
      const decoded = Array.isArray(result)
        ? result[0]?.decodedText
        : result?.decodedText
      if (!decoded) {
        setError("Aucun QR trouvé dans l'image.")
        return
      }
      await handleVerify(decoded)
    } catch (err) {
      console.error("scanFile failed", err)
      setError("Impossible de lire le QR depuis l'image.")
    }
  }

  // Render loading / unauthorized states
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg font-medium">
          Vérification du compte…
        </p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 px-4">
        <h3 className="text-xl font-bold text-red-600 mb-2">Accès refusé</h3>
        <p className="text-gray-700">
          Vous devez être administrateur pour accéder à cette page.
        </p>
      </div>
    )
  }

  // Main UI
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Vérification des tickets — Scan QR
      </h2>

      <div className="mb-6 flex items-center gap-2">
        <input
          type="checkbox"
          checked={markUsed}
          onChange={(e) => setMarkUsed(e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <label className="text-gray-700">
          Marquer le billet comme utilisé après vérification
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        {/* Scanner */}
        <div className="flex flex-col">
          <div
            id={scannerId}
            className="w-full min-h-[300px] bg-black rounded-lg shadow-inner aspect-video"
          />
          <div className="mt-3 flex gap-3">
            {!scanning ? (
              <button
                onClick={startScanner}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
              >
                Démarrer la caméra
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                Arrêter la caméra
              </button>
            )}
            <button
              onClick={() => {
                setLastResult(null)
                setError(null)
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Entrée manuelle / Upload */}
        <div className="w-full max-w-md">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">
            Entrée manuelle / Upload
          </h4>
          <input
            type="text"
            placeholder="Coller ticket UUID ou URL"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
          />
          <div className="flex gap-3">
            <button
              onClick={() => handleVerify(manualInput)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              Vérifier
            </button>
            <label className="px-4 py-2 bg-gray-200 rounded-lg cursor-pointer hover:bg-gray-300 font-medium text-gray-700">
              Upload image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="mt-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">
              Résultat
            </h4>
            {error && <div className="text-red-600">{error}</div>}

            {lastResult ? (
              <div className="p-3 border rounded-lg bg-gray-50 shadow-sm">
                {lastResult.valid ? (
                  <div className="flex items-start gap-4">
                    <div>
                      <div className="text-green-600 font-bold text-lg mb-2">
                        ✅ Valide — participant trouvé
                      </div>
                      {lastResult.participant ? (
                        <div className="space-y-2">
                          <div className="text-sm text-gray-700">
                            <strong>Nom:</strong>{" "}
                            {lastResult.participant.first_name}{" "}
                            {lastResult.participant.last_name}
                          </div>
                          <div className="text-sm text-gray-700">
                            <strong>Email:</strong>{" "}
                            {lastResult.participant.email}
                          </div>
                          <div className="text-sm text-gray-500">
                            <strong>Ticket:</strong>{" "}
                            {lastResult.participant.ticket_uuid}
                          </div>
                          {lastResult.participant.qr_base64 && (
                            <img
                              src={`data:image/png;base64,${lastResult.participant.qr_base64}`}
                              alt="qr"
                              className="mt-2 max-w-xs"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700">
                          Participant: info manquante
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-orange-600 font-bold text-lg mb-2">
                      ⚠️ Invalide / déjà utilisé
                    </div>
                    {lastResult.already_used && (
                      <div className="text-sm text-gray-700 mb-2">
                        Ce billet a déjà été utilisé.
                      </div>
                    )}
                    {lastResult.reason && (
                      <div className="text-sm text-gray-700">
                        {lastResult.reason}
                      </div>
                    )}
                    {lastResult.participant && (
                      <div className="mt-3 p-2 bg-white border rounded">
                        <div className="text-sm text-gray-700">
                          <strong>Nom:</strong>{" "}
                          {lastResult.participant.first_name}{" "}
                          {lastResult.participant.last_name}
                        </div>
                        <div className="text-sm text-gray-700">
                          <strong>Email:</strong> {lastResult.participant.email}
                        </div>
                        <div className="text-sm text-gray-500">
                          <strong>Ticket:</strong>{" "}
                          {lastResult.participant.ticket_uuid}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 italic">Aucun résultat</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
