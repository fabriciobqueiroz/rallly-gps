// Tela cheia (Modal) que respeita a barra de navegação e a barra de status do celular.
import { Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function Tela({ visible = true, onRequestClose, animationType = 'slide', children }) {
  return (
    <Modal visible={visible} animationType={animationType} onRequestClose={onRequestClose} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0c1014' }} edges={['top', 'bottom', 'left', 'right']}>
          {children}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
