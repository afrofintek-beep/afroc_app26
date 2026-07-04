import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Camera, FileSignature, User, Phone, CheckCircle, Image as ImageIcon, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCamera } from "@/hooks/useCamera";
import { useExifExtractor, ExifData } from "@/hooks/useExifExtractor";
import { CompressionResult } from "@/utils/imageCompression";
import { ImageCompressionPreview } from "@/components/ImageCompressionPreview";
import { useLanguage } from "@/contexts/LanguageContext";

interface OfflineWitness {
  witness_afro_id: string;
  witness_name?: string;
  witness_phone?: string;
  signature?: string;
  photo?: string;
  photo_exif?: ExifData;
  captured_at: string;
  validation_method: 'otp' | 'signature' | 'photo' | 'in_person';
}

interface Props {
  onWitnessAdded: (witness: OfflineWitness) => void;
  witnessCount: number;
}

export function OfflineWitnessCapture({ onWitnessAdded, witnessCount }: Props) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { loading: cameraLoading, takePicture, selectFromGallery } = useCamera();
  const { extractExifData, extracting: exifExtracting } = useExifExtractor();
  
  const [afroId, setAfroId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [validationMethod, setValidationMethod] = useState<'otp' | 'signature' | 'photo' | 'in_person'>('signature');
  const [signature, setSignature] = useState<string>("");
  const [originalPhoto, setOriginalPhoto] = useState<string>("");
  const [photo, setPhoto] = useState<string>("");
  const [showCompressionPreview, setShowCompressionPreview] = useState(false);
  const [photoStats, setPhotoStats] = useState<CompressionResult | null>(null);
  const [photoExif, setPhotoExif] = useState<ExifData | null>(null);

  const handleAddWitness = () => {
    if (!afroId.trim()) {
      toast({
        title: t('offwitness_required_field'),
        description: t('offwitness_afroloc_required'),
        variant: "destructive",
      });
      return;
    }

    if (validationMethod === 'otp' && !phone) {
      toast({
        title: t('offwitness_required_field'),
        description: t('offwitness_phone_required_otp'),
        variant: "destructive",
      });
      return;
    }

    if (validationMethod === 'photo' && !photo) {
      toast({
        title: t('offwitness_required_field'),
        description: t('offwitness_photo_required'),
        variant: "destructive",
      });
      return;
    }

    const witness: OfflineWitness = {
      witness_afro_id: afroId,
      witness_name: name || undefined,
      witness_phone: phone || undefined,
      signature: signature || undefined,
      photo: photo || undefined,
      photo_exif: photoExif || undefined,
      captured_at: new Date().toISOString(),
      validation_method: validationMethod,
    };

    onWitnessAdded(witness);

    // Reset form
    setAfroId("");
    setName("");
    setPhone("");
    setSignature("");
    setPhoto("");
    setOriginalPhoto("");
    setPhotoStats(null);
    setPhotoExif(null);

    toast({
      title: t('offwitness_witness_added'),
      description: `${witnessCount + 1} witness${witnessCount + 1 !== 1 ? 'es' : ''} captured offline`,
    });
  };

  const handleTakePhoto = async () => {
    const photoData = await takePicture();
    if (photoData) {
      setOriginalPhoto(photoData);
      setShowCompressionPreview(true);
    }
  };

  const handleSelectPhoto = async () => {
    const photoData = await selectFromGallery();
    if (photoData) {
      setOriginalPhoto(photoData);
      setShowCompressionPreview(true);
    }
  };

  const handleSaveCompressedPhoto = async (compressedImage: string, stats: CompressionResult) => {
    setPhoto(compressedImage);
    setPhotoStats(stats);
    
    // Extract EXIF data from original photo
    const exif = await extractExifData(originalPhoto);
    setPhotoExif(exif);
    
    setShowCompressionPreview(false);
    
    const savings = stats.compressionRatio.toFixed(0);
    const exifInfo = exif?.deviceModel 
      ? ` | Device: ${exif.deviceModel}`
      : exif?.latitude && exif?.longitude
      ? ` | GPS: ${exif.latitude.toFixed(4)}, ${exif.longitude.toFixed(4)}`
      : '';
    
    toast({
      title: t('offwitness_photo_optimized'),
      description: `${(stats.compressedSize / 1024).toFixed(0)}KB (${savings}% saved)`,
    });
  };

  const handleCancelCompression = () => {
    setOriginalPhoto("");
    setShowCompressionPreview(false);
  };

  const handleRemovePhoto = () => {
    setPhoto("");
    setOriginalPhoto("");
    setPhotoStats(null);
    toast({
      title: t('offwitness_photo_removed'),
      description: t('offwitness_photo_removed_desc'),
    });
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          {t('offwitness_title')}
        </CardTitle>
        <CardDescription>
          {t('offwitness_description')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="witness-afroid">{t('offwitness_label_afroloc')} AFROLOC *</Label>
          <Input
            id="witness-afroid"
            value={afroId}
            onChange={(e) => setAfroId(e.target.value.toUpperCase())}
            placeholder={t('offwitness_placeholder_afroloc')}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="witness-name">{t('offwitness_label_name')}</Label>
          <Input
            id="witness-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('offwitness_placeholder_name')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="validation-method">{t('offwitness_label_validation_method')}</Label>
          <Select value={validationMethod} onValueChange={(v: any) => setValidationMethod(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="signature">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4" />
                  {t('offwitness_method_signature')}
                </div>
              </SelectItem>
              <SelectItem value="photo">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  {t('offwitness_method_photo')}
                </div>
              </SelectItem>
              <SelectItem value="in_person">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('offwitness_method_in_person')}
                </div>
              </SelectItem>
              <SelectItem value="otp">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {t('offwitness_method_sms_otp')}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {validationMethod === 'otp' && (
          <div className="space-y-2">
            <Label htmlFor="witness-phone">{t('offwitness_label_phone')}</Label>
            <Input
              id="witness-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+243 XXX XXX XXX"
              type="tel"
            />
            <p className="text-xs text-muted-foreground">
              {t('offwitness_otp_sync_note')}
            </p>
          </div>
        )}

        {validationMethod === 'signature' && (
          <div className="space-y-2">
            <Label>{t('offwitness_label_signature')}</Label>
            <div className="border-2 border-dashed rounded-md p-4 text-center">
              <FileSignature className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                {t('offwitness_signature_placeholder')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('offwitness_signature_prod_note')}
              </p>
            </div>
          </div>
        )}

        {validationMethod === 'photo' && (
          <div className="space-y-2">
            <Label>{t('offwitness_label_id_photo')}</Label>
            
            {photo ? (
              <div className="space-y-2">
                <div className="relative border-2 border-border rounded-md overflow-hidden">
                  <img 
                    src={photo}
                    alt={t('offwitness_alt_id_photo')}
                    className="w-full h-auto max-h-64 object-contain bg-muted"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemovePhoto}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {photoStats && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('offwitness_file_size')}</span>
                      <Badge variant="secondary">
                        {(photoStats.compressedSize / 1024).toFixed(0)}KB
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({photoStats.compressionRatio.toFixed(0)}% saved)
                        </span>
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">{t('offwitness_dimensions')}</span>
                      <span className="font-mono text-xs">
                        {photoStats.width}×{photoStats.height}
                      </span>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground text-center">
                  {t('offwitness_photo_optimized_hint')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="border-2 border-dashed rounded-md p-6 text-center">
                  <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium mb-4">{t('offwitness_capture_document')}</p>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleTakePhoto}
                      disabled={cameraLoading}
                      variant="outline"
                      className="flex-1"
                    >
                      <Camera className={`h-4 w-4 mr-2 ${cameraLoading ? 'animate-pulse' : ''}`} />
                      {cameraLoading ? t('offwitness_opening') : t('offwitness_take_photo')}
                    </Button>
                    
                    <Button
                      onClick={handleSelectPhoto}
                      disabled={cameraLoading}
                      variant="outline"
                      className="flex-1"
                    >
                      <ImageIcon className={`h-4 w-4 mr-2 ${cameraLoading ? 'animate-pulse' : ''}`} />
                      {cameraLoading ? t('offwitness_opening') : t('offwitness_choose_gallery')}
                    </Button>
                  </div>
                </div>
                
                <div className="bg-muted/50 border border-border rounded-md p-3">
                  <p className="text-xs text-muted-foreground">
                    📸 <strong>{t('offwitness_tips_title')}</strong>
                  </p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-1 ml-4">
                    <li>• {t('offwitness_tip_lighting')}</li>
                    <li>• {t('offwitness_tip_flat')}</li>
                    <li>• {t('offwitness_tip_corners')}</li>
                    <li>• {t('offwitness_tip_glare')}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {validationMethod === 'in_person' && (
          <div className="bg-muted/50 border border-border rounded-md p-3">
            <p className="text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 inline mr-1" />
              {t('offwitness_in_person_note')}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleAddWitness}
            className="flex-1"
            disabled={!afroId || (validationMethod === 'otp' && !phone) || (validationMethod === 'photo' && !photo)}
          >
            <User className="h-4 w-4 mr-2" />
            {t('offwitness_add_witness_btn')}
          </Button>
        </div>

        {validationMethod === 'otp' && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-3">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <Phone className="h-3 w-3 inline mr-1" />
              {t('offwitness_otp_queue_note')}
            </p>
          </div>
        )}

        {/* Compression Preview Dialog */}
        <ImageCompressionPreview
          open={showCompressionPreview}
          originalImage={originalPhoto}
          outputFormat="base64"
          onSave={handleSaveCompressedPhoto}
          onCancel={handleCancelCompression}
        />
      </CardContent>
    </Card>
  );
}
