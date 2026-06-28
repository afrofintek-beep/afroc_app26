import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Plus, Trash2, Edit, MapPin, Signal, Search, Circle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface CellTower {
  id: string;
  cell_id: string;
  technology: string;
  latitude: number;
  longitude: number;
  coverage_radius_meters: number;
  is_active: boolean;
  telecom_operator_id: string | null;
  level1_name: string | null;
  level2_name: string | null;
  mcc: string;
  mnc: string;
}

interface TelecomOperator {
  id: string;
  operator_name: string;
  operator_code: string;
}

export default function AdminCellTowers() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [towers, setTowers] = useState<CellTower[]>([]);
  const [operators, setOperators] = useState<TelecomOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTech, setFilterTech] = useState<string>("all");
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTower, setEditingTower] = useState<CellTower | null>(null);
  const [showCoverage, setShowCoverage] = useState(true);
  const [formData, setFormData] = useState({
    cell_id: "",
    technology: "4G",
    latitude: "",
    longitude: "",
    coverage_radius_meters: "1000",
    telecom_operator_id: "",
    mcc: "631",
    mnc: "",
    level1_name: "",
    level2_name: ""
  });

  useEffect(() => {
    fetchMapToken();
    fetchTowers();
    fetchOperators();
  }, []);

  useEffect(() => {
    if (mapToken && mapContainer.current && !map.current) {
      initMap();
    }
  }, [mapToken]);

  useEffect(() => {
    if (map.current) updateMapMarkers();
  }, [towers, filterTech, filterOperator, searchQuery, showCoverage]);

  const fetchMapToken = async () => {
    const { data } = await supabase.functions.invoke("get-mapbox-token");
    if (data?.token) setMapToken(data.token);
  };

  const fetchTowers = async () => {
    const { data, error } = await supabase.from("cell_towers").select("*").order("created_at", { ascending: false });
    if (!error && data) setTowers(data);
    setLoading(false);
  };

  const fetchOperators = async () => {
    const { data } = await supabase.from("telecom_operators").select("id, operator_name, operator_code").eq("is_active", true);
    if (data) setOperators(data);
  };

  const initMap = () => {
    if (!mapToken || !mapContainer.current) return;
    mapboxgl.accessToken = mapToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [17.5, -12.5],
      zoom: 5
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.on("load", () => {
      map.current!.addSource("coverage-circles", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.current!.addLayer({
        id: "coverage-fill",
        type: "fill",
        source: "coverage-circles",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.15 }
      });
      map.current!.addLayer({
        id: "coverage-outline",
        type: "line",
        source: "coverage-circles",
        paint: { "line-color": ["get", "color"], "line-width": 2, "line-opacity": 0.6 }
      });
      updateMapMarkers();
    });
  };

  const createCirclePolygon = (lng: number, lat: number, radiusMeters: number, points = 64) => {
    const coords = [];
    const km = radiusMeters / 1000;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = km * Math.cos(angle) / (111.32 * Math.cos(lat * Math.PI / 180));
      const dy = km * Math.sin(angle) / 110.574;
      coords.push([lng + dx, lat + dy]);
    }
    return coords;
  };

  const updateMapMarkers = () => {
    if (!map.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = getFilteredTowers();
    
    // Update coverage circles
    const source = map.current.getSource("coverage-circles") as mapboxgl.GeoJSONSource;
    if (source && showCoverage) {
      const features = filtered.map(tower => ({
        type: "Feature" as const,
        properties: { color: tower.technology === "4G" ? "#22c55e" : tower.technology === "3G" ? "#eab308" : "#ef4444" },
        geometry: { type: "Polygon" as const, coordinates: [createCirclePolygon(tower.longitude, tower.latitude, tower.coverage_radius_meters)] }
      }));
      source.setData({ type: "FeatureCollection", features });
    } else if (source) {
      source.setData({ type: "FeatureCollection", features: [] });
    }

    filtered.forEach(tower => {
      const color = tower.technology === "4G" ? "#22c55e" : tower.technology === "3G" ? "#eab308" : "#ef4444";
      const el = document.createElement("div");
      el.className = "tower-marker";
      el.style.cssText = `width:24px;height:24px;background:${color};border-radius:50%;border:2px solid white;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;`;
      el.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([tower.longitude, tower.latitude])
        .setPopup(new mapboxgl.Popup().setHTML(`
          <div style="color:#000;padding:8px;">
            <strong>${tower.cell_id}</strong><br/>
            <span>${tower.technology} • ${tower.coverage_radius_meters}m</span><br/>
            <span>${tower.level1_name || ""} ${tower.level2_name || ""}</span>
          </div>
        `))
        .addTo(map.current!);
      markersRef.current.push(marker);
    });
  };

  const getFilteredTowers = () => {
    return towers.filter(t => {
      if (filterTech !== "all" && t.technology !== filterTech) return false;
      if (filterOperator !== "all" && t.telecom_operator_id !== filterOperator) return false;
      if (searchQuery && !t.cell_id.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !t.level1_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  };

  const handleSubmit = async () => {
    const payload = {
      cell_id: formData.cell_id,
      technology: formData.technology,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      coverage_radius_meters: parseInt(formData.coverage_radius_meters),
      telecom_operator_id: formData.telecom_operator_id || null,
      mcc: formData.mcc,
      mnc: formData.mnc,
      level1_name: formData.level1_name || null,
      level2_name: formData.level2_name || null,
      country_code: "AO"
    };

    let error;
    if (editingTower) {
      ({ error } = await supabase.from("cell_towers").update(payload).eq("id", editingTower.id));
    } else {
      ({ error } = await supabase.from("cell_towers").insert(payload));
    }

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingTower ? "Torre atualizada" : "Torre adicionada" });
      fetchTowers();
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("cell_towers").delete().eq("id", id);
    if (!error) {
      toast({ title: "Torre removida" });
      fetchTowers();
    }
  };

  const resetForm = () => {
    setFormData({ cell_id: "", technology: "4G", latitude: "", longitude: "", coverage_radius_meters: "1000", telecom_operator_id: "", mcc: "631", mnc: "", level1_name: "", level2_name: "" });
    setEditingTower(null);
    setIsAddDialogOpen(false);
  };

  const openEdit = (tower: CellTower) => {
    setFormData({
      cell_id: tower.cell_id,
      technology: tower.technology,
      latitude: String(tower.latitude),
      longitude: String(tower.longitude),
      coverage_radius_meters: String(tower.coverage_radius_meters),
      telecom_operator_id: tower.telecom_operator_id || "",
      mcc: tower.mcc,
      mnc: tower.mnc,
      level1_name: tower.level1_name || "",
      level2_name: tower.level2_name || ""
    });
    setEditingTower(tower);
    setIsAddDialogOpen(true);
  };

  const focusTower = (tower: CellTower) => {
    map.current?.flyTo({ center: [tower.longitude, tower.latitude], zoom: 14 });
  };

  const filtered = getFilteredTowers();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{t("cell_towers") || "Torres de Celular"}</h1>
              <p className="text-muted-foreground">{t("manage_cell_towers") || "Gerenciar torres de rede móvel"}</p>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> {t("add_tower") || "Adicionar Torre"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTower ? "Editar Torre" : "Nova Torre"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Cell ID</Label><Input value={formData.cell_id} onChange={e => setFormData({...formData, cell_id: e.target.value})} /></div>
                  <div><Label>Tecnologia</Label>
                    <Select value={formData.technology} onValueChange={v => setFormData({...formData, technology: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="4G">4G LTE</SelectItem><SelectItem value="3G">3G</SelectItem><SelectItem value="2G">2G GSM</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Latitude</Label><Input type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} /></div>
                  <div><Label>Longitude</Label><Input type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Raio (m)</Label><Input type="number" value={formData.coverage_radius_meters} onChange={e => setFormData({...formData, coverage_radius_meters: e.target.value})} /></div>
                  <div><Label>Operadora</Label>
                    <Select value={formData.telecom_operator_id} onValueChange={v => setFormData({...formData, telecom_operator_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>{operators.map(op => <SelectItem key={op.id} value={op.id}>{op.operator_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>MCC</Label><Input value={formData.mcc} onChange={e => setFormData({...formData, mcc: e.target.value})} /></div>
                  <div><Label>MNC</Label><Input value={formData.mnc} onChange={e => setFormData({...formData, mnc: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Província</Label><Input value={formData.level1_name} onChange={e => setFormData({...formData, level1_name: e.target.value})} /></div>
                  <div><Label>Município</Label><Input value={formData.level2_name} onChange={e => setFormData({...formData, level2_name: e.target.value})} /></div>
                </div>
                <Button onClick={handleSubmit} className="w-full">{editingTower ? "Atualizar" : "Adicionar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Mapa de Torres</CardTitle>
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cobertura</span>
                  <Switch checked={showCoverage} onCheckedChange={setShowCoverage} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={mapContainer} className="h-[400px] rounded-lg overflow-hidden" />
              <div className="flex gap-4 mt-3 text-sm">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> 4G</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500" /> 3G</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> 2G</span>
                {showCoverage && <span className="flex items-center gap-1 ml-4"><Circle className="h-3 w-3 text-muted-foreground" /> Área de cobertura</span>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Signal className="h-5 w-5" /> Estatísticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-3xl font-bold text-primary">{towers.length}</div>
                  <div className="text-sm text-muted-foreground">Total de Torres</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-3xl font-bold text-green-500">{towers.filter(t => t.technology === "4G").length}</div>
                  <div className="text-sm text-muted-foreground">Torres 4G</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-3xl font-bold text-yellow-500">{towers.filter(t => t.technology === "3G").length}</div>
                  <div className="text-sm text-muted-foreground">Torres 3G</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-3xl font-bold text-red-500">{towers.filter(t => t.technology === "2G").length}</div>
                  <div className="text-sm text-muted-foreground">Torres 2G</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <CardTitle>Lista de Torres ({filtered.length})</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-9 w-48" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <Select value={filterTech} onValueChange={setFilterTech}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="4G">4G</SelectItem><SelectItem value="3G">3G</SelectItem><SelectItem value="2G">2G</SelectItem></SelectContent>
                </Select>
                <Select value={filterOperator} onValueChange={setFilterOperator}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Operadora" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas</SelectItem>{operators.map(op => <SelectItem key={op.id} value={op.id}>{op.operator_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cell ID</TableHead>
                    <TableHead>Tech</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Raio</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma torre encontrada</TableCell></TableRow>
                  ) : (
                    filtered.slice(0, 50).map(tower => (
                      <TableRow key={tower.id}>
                        <TableCell className="font-mono">{tower.cell_id}</TableCell>
                        <TableCell><Badge variant={tower.technology === "4G" ? "default" : tower.technology === "3G" ? "secondary" : "outline"}>{tower.technology}</Badge></TableCell>
                        <TableCell className="text-xs">{tower.latitude.toFixed(4)}, {tower.longitude.toFixed(4)}</TableCell>
                        <TableCell>{tower.coverage_radius_meters}m</TableCell>
                        <TableCell className="text-sm">{tower.level1_name} {tower.level2_name && `/ ${tower.level2_name}`}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => focusTower(tower)}><MapPin className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(tower)}><Edit className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(tower.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
