import {beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const {invoke,auth}=vi.hoisted(()=>({invoke:vi.fn(),auth:{user:{id:'resident'} as {id:string}|null}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/lib/authedInvoke',()=>({authedInvoke:invoke}));
vi.mock('@/components/account-link/AccountPhoneConfirmation',()=>({default:()=> <p>Phone widget</p>}));
import ResidencePilot from '@/pages/ResidencePilot';
const snapshot={ok:true,admin:false,settings:{enabled:true,boundary_version:'v1'},addresses:[{id:'record-1',code:'AFROLOC-TEST'}],requests:[],invitations:[]};
beforeEach(()=>{auth.user={id:'resident'};invoke.mockReset();invoke.mockResolvedValue({data:snapshot,error:null});});
const show=()=>render(<MemoryRouter><ResidencePilot/></MemoryRouter>);
describe('residence pilot forms',()=>{
 it('requires login before loading private evidence',()=>{auth.user=null;show();expect(screen.getByText('Entrar')).toBeInTheDocument();expect(invoke).not.toHaveBeenCalled();});
 it('selects owned addresses and submits explicit consent',async()=>{
  show();await screen.findByText('AFROLOC-TEST');
  fireEvent.change(screen.getByLabelText('A sua morada AFROLOC'),{target:{value:'record-1'}});
  fireEvent.change(screen.getByLabelText('Morada legível: rua, lote, casa ou apartamento'),{target:{value:'Rua 1, casa 2'}});
  fireEvent.click(screen.getByLabelText(/Declaro residir nesta morada/));
  fireEvent.click(screen.getByText('Registar pedido'));
  await waitFor(()=>expect(invoke).toHaveBeenCalledWith('residence-pilot',{action:'create',id:'record-1',data:{address_label:'Rua 1, casa 2',consent:true}}));
 });
 it('witness can decline without claiming residence knowledge',async()=>{
  invoke.mockResolvedValue({data:{...snapshot,invitations:[{id:'invite-1',full_name:'Pessoa Teste',code:'CODE-1',address_label:'Rua Teste',record_updated_at:'2026-01-01',boundary_version:'v1',expires_at:'2026-12-01'}]},error:null});
  show();await screen.findByText('Pessoa Teste');
  fireEvent.change(screen.getByLabelText('Resposta'),{target:{value:'unknown'}});
  fireEvent.change(screen.getByLabelText(/Relação com a pessoa/),{target:{value:'Colega'}});
  fireEvent.change(screen.getByLabelText('Conheço a pessoa desde'),{target:{value:'2020-01-01'}});
  fireEvent.change(screen.getByLabelText(/Partilham o mesmo agregado/),{target:{value:'no'}});
  fireEvent.click(screen.getByLabelText(/Declaro de boa-fé/));fireEvent.click(screen.getByText('Registar declaração'));
  await waitFor(()=>expect(invoke).toHaveBeenCalledWith('residence-pilot',expect.objectContaining({action:'declare',id:'invite-1',data:expect.objectContaining({answer:'unknown',knows_person:false,knows_residence:false,same_household:false,consent:true})})));
 });
 it('does not show authority forms to a resident',async()=>{show();await screen.findByText('AFROLOC-TEST');expect(screen.queryByText('Preparação pela autoridade')).not.toBeInTheDocument();});
});
