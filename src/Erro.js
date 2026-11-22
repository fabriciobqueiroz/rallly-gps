// Evita que um erro de tela feche o app inteiro: mostra o texto do erro e deixa voltar.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default class Erro extends React.Component {
  state = { e: null };
  static getDerivedStateFromError(e) { return { e }; }
  render() {
    if (!this.state.e) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: '#ff5252', fontSize: 18, fontWeight: '800' }}>Ocorreu um erro nesta tela</Text>
        <Text style={{ color: '#fff', marginTop: 10 }}>{String((this.state.e && this.state.e.message) || this.state.e)}</Text>
        <Text style={{ color: '#888', marginTop: 8, fontSize: 11 }}>{String((this.state.e && this.state.e.stack) || '').slice(0, 600)}</Text>
        <TouchableOpacity style={{ backgroundColor: '#ff7a2e', borderRadius: 10, padding: 16, marginTop: 20, alignItems: 'center' }} onPress={() => { this.setState({ e: null }); this.props.onClose && this.props.onClose(); }}>
          <Text style={{ fontWeight: '900', fontSize: 16 }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
