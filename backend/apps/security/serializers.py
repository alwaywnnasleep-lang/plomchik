from rest_framework import serializers


class SecurityStatusSerializer(serializers.Serializer):
    encryption = serializers.DictField()
    network = serializers.DictField()
    access_control = serializers.DictField()
    audit = serializers.DictField()
    backup = serializers.DictField()
    compliance = serializers.DictField()
    overall_status = serializers.CharField()