import type { ReactNode } from 'react'
import { Stack } from 'expo-router'
import MobileWebShellRoute from './[hostId]/web'
import { colors } from '../../src/theme/mobile-theme'

function renderHostScreen({
  children,
  route
}: {
  children: ReactNode
  route: { name: string; params?: object }
}) {
  // Keep the navigator mounted for notification handoffs; work screens render inside the shell.
  return route.name === '[hostId]/edit' ? (
    <>{children}</>
  ) : (
    <MobileWebShellRoute routeName={route.name} routeParams={route.params} />
  )
}

export default function HostGroupLayout() {
  return (
    <Stack
      screenLayout={renderHostScreen}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBase } }}
    />
  )
}
