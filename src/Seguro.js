// Mantém o conteúdo de um Modal fora da barra de navegação do Android (botões ≡ ○ ‹), para o toque nos cantos não acionar o sistema.
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function Seguro({ children }) {
  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: '#000' }}>{children}</SafeAreaView>
    </SafeAreaProvider>
  );
}
