import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

async function source(relativePath) {
  return readFile(join(repositoryRoot, ...relativePath.split('/')), 'utf8')
}

test('un error de datos no se presenta como viaje inexistente', async () => {
  const [detailPage, editPage, errorBoundary, notFoundPage] = await Promise.all([
    source('src/app/viajes/[id]/page.tsx'),
    source('src/app/viajes/[id]/editar/page.tsx'),
    source('src/app/viajes/[id]/error.tsx'),
    source('src/app/viajes/[id]/not-found.tsx'),
  ])

  assert.match(detailPage, /if \(tripError\)[\s\S]*throw new Error[\s\S]*if \(!trip\) notFound\(\)/)
  assert.match(editPage, /if \(error\)[\s\S]*throw new Error[\s\S]*if \(!trip\) notFound\(\)/)
  assert.match(errorBoundary, /'use client'/)
  assert.match(errorBoundary, /onClick=\{reset\}/)
  assert.match(detailPage, /if \(!isUuid\(id\)\) notFound\(\)/)
  assert.match(editPage, /if \(!isUuid\(id\)\) notFound\(\)/)
  assert.match(notFoundPage, /Viaje no encontrado/)
  assert.match(notFoundPage, /href="\/viajes"/)
})

test('las páginas fuera de rango vuelven a una página válida', async () => {
  const [activeTrips, history] = await Promise.all([
    source('src/app/viajes/page.tsx'),
    source('src/app/historial/page.tsx'),
  ])

  assert.match(activeTrips, /currentPage > totalPages[\s\S]*redirect\(viajesHref/)
  assert.match(history, /currentPage > totalPages[\s\S]*redirect\(historialHref/)
  assert.match(activeTrips, /error\?\.code === ['"]PGRST103['"][\s\S]*head: true[\s\S]*redirect\(viajesHref/)
  assert.match(history, /error\?\.code === ['"]PGRST103['"][\s\S]*head: true[\s\S]*redirect\(historialHref/)
})

test('un administrador puede reabrir desde el detalle finalizado', async () => {
  const detailPage = await source('src/app/viajes/[id]/page.tsx')
  assert.match(detailPage, /isAdmin && isFinished \? <ReopenTripButton/)
})
