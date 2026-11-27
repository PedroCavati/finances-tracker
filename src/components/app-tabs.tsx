import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/** Barra de abas nativa (iOS/Android). Cada `Trigger` aponta para um arquivo em `app/(tabs)/`. */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      tintColor={colors.tint}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Label>Lançamentos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="receipt_long" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="accounts">
        <NativeTabs.Trigger.Label>Contas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} md="account_balance_wallet" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="categories">
        <NativeTabs.Trigger.Label>Categorias</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="category" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
